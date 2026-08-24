import superjson from "superjson";
import { db } from "../helpers/db";
import { getServerUserSession } from "../helpers/getServerUserSession";
import { validateIdentityDocument } from "../helpers/identityTypes";
import { verifyIdentityWithRegistry } from "../helpers/verifyIdentity";
import { consentVersion } from "../helpers/consentVersion";
import { fingerprintIdentity } from "../helpers/fingerprintIdentity";
import { schema, type OutputType } from "./identity-verify_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const check = validateIdentityDocument(input.identityType, input.identityNumber, input.identityCountry);
    if (!check.formatValid) return new Response(superjson.stringify({ error: check.message }), { status: 400 });

    const customer = await db.selectFrom("vendingCustomers").selectAll().where("userId", "=", user.id).executeTakeFirst();
    const fingerprint = fingerprintIdentity(check.type, check.country, check.normalized);
    if (!customer || customer.identityType !== check.type || customer.identityCountry !== check.country || customer.identityNumberFingerprint !== fingerprint) {
      return new Response(superjson.stringify({ error: "Save this identification document to your profile before verifying it." }), { status: 409 });
    }
    if (!customer.identityConsentAt || !customer.termsAcceptedAt || customer.consentVersion !== consentVersion) {
      return new Response(superjson.stringify({ error: "Accept the current identity-verification consent, Terms and Privacy Notice before sending identity data to CPay." }), { status: 409 });
    }

    const fullName = [customer.firstName, customer.middleName, customer.lastName].map((value) => value?.trim()).filter(Boolean).join(" ");
    const result = await verifyIdentityWithRegistry(check.type, check.normalized, check.country, {
      fullName: fullName || null,
      msisdn: customer.phoneNumber,
      consentGranted: true,
    });
    const now = new Date();
    const legacyNinStatus = result.status === "VERIFIED" ? "VERIFIED" as const
      : result.status === "VERIFICATION_PENDING" ? "PENDING_REGISTRY" as const
      : result.status === "VERIFICATION_FAILED" || result.status === "REVIEW_REQUIRED" ? "FAILED" as const
      : "FORMAT_VALID" as const;
    await db.updateTable("vendingCustomers").set({
      identityVerificationStatus: result.status,
      identityVerificationReference: result.requestReference ?? customer.identityVerificationReference,
      identityVerifiedAt: result.status === "VERIFIED" ? now : null,
      ...(check.type === "NIN" ? { ninVerificationStatus: legacyNinStatus } : {}),
      updatedAt: now,
    }).where("id", "=", customer.id).execute();
    return new Response(superjson.stringify(result satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify identification document";
    return new Response(superjson.stringify({ error: message }), { status: message.toLowerCase().includes("auth") ? 401 : 400 });
  }
}
