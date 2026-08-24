import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { clearServerSession } from "../../helpers/getSetServerSession";
import type { OutputType } from "./delete_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const customer = await db.selectFrom("vendingCustomers").selectAll().where("userId", "=", user.id).executeTakeFirst();

    if (customer) {
      const openRental = await db.selectFrom("vendingRentals")
        .select(["reference", "status"])
        .where("customerId", "=", customer.id)
        .where("status", "not in", ["COMPLETED", "CANCELLED"])
        .orderBy("createdAt", "desc")
        .executeTakeFirst();
      if (openRental) {
        return new Response(superjson.stringify({
          error: `Account deletion is unavailable while rental ${openRental.reference} is ${openRental.status.replaceAll("_", " ").toLowerCase()}. Complete or resolve that rental first.`,
        }), { status: 409 });
      }
    }

    await db.transaction().execute(async (trx) => {
      if (customer) {
        // Retain non-identifying rental/ledger correlation for financial audit while
        // removing customer contact data after every rental is terminal.
        await trx.updateTable("vendingRentals").set({
          paymentPhoneNumber: null,
          refundPhoneNumber: null,
          paymentCardLast4: null,
          updatedAt: new Date(),
        }).where("customerId", "=", customer.id).execute();

        await trx.updateTable("vendingCustomers").set({
          userId: null,
          firstName: null,
          middleName: null,
          lastName: null,
          nin: null,
          ninFingerprint: null,
          ninLastFour: null,
          ninVerificationStatus: "NOT_SUBMITTED",
          identityType: null,
          identityCountry: null,
          identityNumberFingerprint: null,
          identityNumberLastFour: null,
          identityVerificationStatus: "NOT_SUBMITTED",
          identityVerificationReference: null,
          identityVerifiedAt: null,
          phoneNumber: null,
          phoneVerifiedAt: null,
          identityConsentAt: null,
          termsAcceptedAt: null,
          consentVersion: null,
          updatedAt: new Date(),
        }).where("id", "=", customer.id).execute();
      }

      await trx.deleteFrom("oauthAccounts").where("userId", "=", user.id).execute();
      await trx.deleteFrom("userPasswords").where("userId", "=", user.id).execute();
      await trx.deleteFrom("sessions").where("userId", "=", user.id).execute();
      await trx.deleteFrom("pushSubscriptions").where("userId", "=", String(user.id)).execute();
      await trx.deleteFrom("loginAttempts").where("email", "=", user.email).execute();
      await trx.deleteFrom("users").where("id", "=", user.id).execute();
    });

    const response = new Response(superjson.stringify({ deleted: true } satisfies OutputType));
    clearServerSession(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account deletion failed";
    return new Response(superjson.stringify({ error: message }), { status: message.toLowerCase().includes("auth") ? 401 : 400 });
  }
}
