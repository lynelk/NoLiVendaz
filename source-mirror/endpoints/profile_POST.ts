import superjson from "superjson";
import { db } from "../helpers/db";
import { getServerUserSession } from "../helpers/getServerUserSession";
import { normalizePhoneNumber } from "../helpers/normalizePhoneNumber";
import { validateIdentityDocument, type IdentityDocumentType } from "../helpers/identityTypes";
import { consentVersion } from "../helpers/consentVersion";
import { fingerprintIdentity } from "../helpers/fingerprintIdentity";
import { buildCustomerProfile } from "../helpers/customerProfileView";
import { schema, type OutputType } from "./profile_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const current = await db.selectFrom("vendingCustomers").selectAll().where("userId", "=", user.id).executeTakeFirst();

    const rawPhone = input.phoneNumber.trim();
    const phoneNumber = rawPhone ? normalizePhoneNumber(rawPhone) : null;
    const legacyNin = input.nin.trim();
    const requestedType = (input.identityType ?? (legacyNin ? "NIN" : current?.identityType ?? null)) as IdentityDocumentType | null;
    const enteredIdentity = (input.identityNumber.trim() || legacyNin).trim();
    const requestedCountry = (input.identityCountry || current?.identityCountry || "UG").trim().toUpperCase();

    if (current?.identityType && requestedType && requestedType !== current.identityType && !enteredIdentity) {
      return new Response(superjson.stringify({ error: "Enter the new identification number when changing identification type." }), { status: 400 });
    }

    const identityCheck = enteredIdentity && requestedType ? validateIdentityDocument(requestedType, enteredIdentity, requestedCountry) : null;
    if (identityCheck && !identityCheck.formatValid) {
      return new Response(superjson.stringify({ error: identityCheck.message }), { status: 400 });
    }

    const nextIdentityType = identityCheck ? identityCheck.type : current?.identityType ?? requestedType;
    const nextIdentityCountry = identityCheck ? identityCheck.country : current?.identityCountry ?? (nextIdentityType ? requestedCountry : null);
    const nextIdentityFingerprint = identityCheck
      ? fingerprintIdentity(identityCheck.type, identityCheck.country, identityCheck.normalized)
      : current?.identityNumberFingerprint ?? null;
    const nextIdentityLastFour = identityCheck ? identityCheck.normalized.slice(-4) : current?.identityNumberLastFour ?? null;

    const phoneChanged = Boolean(current && current.phoneNumber !== phoneNumber);
    const identityChanged = Boolean(current && (
      current.identityType !== nextIdentityType
      || current.identityCountry !== nextIdentityCountry
      || current.identityNumberFingerprint !== nextIdentityFingerprint
    ));

    if (current && (phoneChanged || identityChanged)) {
      const openRental = await db.selectFrom("vendingRentals").select(["reference"])
        .where("customerId", "=", current.id).where("status", "not in", ["COMPLETED", "CANCELLED"])
        .executeTakeFirst();
      if (openRental) {
        return new Response(superjson.stringify({ error: `Resolve open rental ${openRental.reference} before changing your registered phone or identification document.` }), { status: 409 });
      }
    }

    if (phoneNumber) {
      const phoneOwner = await db.selectFrom("vendingCustomers").select(["id"]).where("phoneNumber", "=", phoneNumber).executeTakeFirst();
      if (phoneOwner && phoneOwner.id !== current?.id) {
        return new Response(superjson.stringify({ error: "This phone number is already linked to another NOLI Vendaz account." }), { status: 409 });
      }
    }
    if (nextIdentityType && nextIdentityCountry && nextIdentityFingerprint) {
      const identityOwner = await db.selectFrom("vendingCustomers").select(["id"])
        .where("identityType", "=", nextIdentityType)
        .where("identityCountry", "=", nextIdentityCountry)
        .where("identityNumberFingerprint", "=", nextIdentityFingerprint)
        .executeTakeFirst();
      if (identityOwner && identityOwner.id !== current?.id) {
        return new Response(superjson.stringify({ error: "This identification document is already linked to another NOLI Vendaz account." }), { status: 409 });
      }
    }

    const acceptedAt = new Date();
    const currentIdentityStatus = current?.identityVerificationStatus ?? "NOT_SUBMITTED";
    const identityStatus = identityCheck && (!current || identityChanged)
      ? "FORMAT_VALID" as const
      : currentIdentityStatus;
    const isNin = nextIdentityType === "NIN";

    const values = {
      firstName: input.firstName,
      middleName: input.middleName || null,
      lastName: input.lastName,
      phoneNumber,
      phoneVerifiedAt: phoneChanged ? null : current?.phoneVerifiedAt ?? null,
      identityType: nextIdentityType,
      identityCountry: nextIdentityCountry,
      identityNumberFingerprint: nextIdentityFingerprint,
      identityNumberLastFour: nextIdentityLastFour,
      identityVerificationStatus: identityStatus,
      identityVerificationReference: identityChanged ? null : current?.identityVerificationReference ?? null,
      identityVerifiedAt: identityChanged ? null : current?.identityVerifiedAt ?? null,
      identityConsentAt: input.identityConsent ? (current?.identityConsentAt && current.consentVersion === consentVersion ? current.identityConsentAt : acceptedAt) : null,
      termsAcceptedAt: input.termsAccepted ? (current?.termsAcceptedAt && current.consentVersion === consentVersion ? current.termsAcceptedAt : acceptedAt) : null,
      consentVersion: input.identityConsent || input.termsAccepted ? consentVersion : current?.consentVersion ?? null,
      nin: null,
      ninFingerprint: isNin ? nextIdentityFingerprint : null,
      ninLastFour: isNin ? nextIdentityLastFour : null,
      ninVerificationStatus: isNin
        ? identityStatus === "VERIFIED" ? "VERIFIED" as const
          : identityStatus === "VERIFICATION_PENDING" ? "PENDING_REGISTRY" as const
          : identityStatus === "VERIFICATION_FAILED" || identityStatus === "REVIEW_REQUIRED" ? "FAILED" as const
          : identityStatus === "FORMAT_VALID" ? "FORMAT_VALID" as const
          : "NOT_SUBMITTED" as const
        : "NOT_SUBMITTED" as const,
      updatedAt: new Date(),
    };

    const row = current
      ? await db.updateTable("vendingCustomers").set(values).where("id", "=", current.id).returningAll().executeTakeFirstOrThrow()
      : await db.insertInto("vendingCustomers").values({ ...values, userId: user.id }).returningAll().executeTakeFirstOrThrow();

    await db.updateTable("users").set({ displayName: [row.firstName, row.middleName, row.lastName].filter(Boolean).join(" "), updatedAt: new Date() }).where("id", "=", user.id).execute();
    return new Response(superjson.stringify({ profile: buildCustomerProfile(row) } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save profile";
    return new Response(superjson.stringify({ error: message }), { status: message.toLowerCase().includes("auth") ? 401 : 400 });
  }
}
