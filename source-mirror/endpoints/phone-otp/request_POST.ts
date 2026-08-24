import crypto from "crypto";
import superjson from "superjson";
import { sql } from "kysely";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { normalizePhoneNumber } from "../../helpers/normalizePhoneNumber";
import { sendSms } from "../../helpers/sendSms";
import { schema, type OutputType } from "./request_POST.schema";

class OtpRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const phoneNumber = normalizePhoneNumber(input.phoneNumber);
    await db.transaction().execute(async (trx) => {
      // Serialize rate-limit reservations for both the authenticated user and destination phone.
      // The reservation, SMS send and any registered-phone change commit as one unit.
      await sql`select pg_advisory_xact_lock(hashtext(${`noli:otp:user:${user.id}`}))`.execute(trx);
      await sql`select pg_advisory_xact_lock(hashtext(${`noli:otp:phone:${phoneNumber}`}))`.execute(trx);

      let customer = await trx.selectFrom("vendingCustomers").selectAll()
        .where("userId", "=", user.id).forUpdate().executeTakeFirst();
      if (customer?.phoneNumber && normalizePhoneNumber(customer.phoneNumber) === phoneNumber && customer.phoneVerifiedAt) {
        throw new OtpRequestError("This registered phone is already verified.", 409);
      }

      const phoneOwner = await trx.selectFrom("vendingCustomers").select(["id"])
        .where("phoneNumber", "=", phoneNumber).executeTakeFirst();
      if (phoneOwner && phoneOwner.id !== customer?.id) {
        throw new OtpRequestError("This phone number is already linked to another NOLI Vendaz account.", 409);
      }

      const phoneChanged = customer?.phoneNumber !== phoneNumber;
      if (customer && phoneChanged) {
        const openRental = await trx.selectFrom("vendingRentals").select(["reference"])
          .where("customerId", "=", customer.id).where("status", "not in", ["COMPLETED", "CANCELLED"])
          .executeTakeFirst();
        if (openRental) {
          throw new OtpRequestError(`Resolve open rental ${openRental.reference} before changing your registered phone.`, 409);
        }
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60_000);
      const userWindow = await trx.selectFrom("phoneVerificationCodes").select(({ fn }) => fn.countAll<number>().as("count"))
        .where("userId", "=", user.id).where("createdAt", ">=", oneHourAgo).executeTakeFirstOrThrow();
      const phoneWindow = await trx.selectFrom("phoneVerificationCodes").select(({ fn }) => fn.countAll<number>().as("count"))
        .where("phoneNumber", "=", phoneNumber).where("createdAt", ">=", oneHourAgo).executeTakeFirstOrThrow();
      if (Number(userWindow.count) >= 6 || Number(phoneWindow.count) >= 4) {
        throw new OtpRequestError("Too many verification codes have been sent recently. Wait before requesting another SMS.", 429);
      }

      const latestForUser = await trx.selectFrom("phoneVerificationCodes").select(["createdAt"])
        .where("userId", "=", user.id).orderBy("createdAt", "desc").executeTakeFirst();
      if (latestForUser && Date.now() - latestForUser.createdAt.getTime() < 30_000) {
        throw new OtpRequestError("Please wait before requesting another verification code.", 429);
      }
      const latest = await trx.selectFrom("phoneVerificationCodes").select(["createdAt"])
        .where("userId", "=", user.id).where("phoneNumber", "=", phoneNumber)
        .orderBy("createdAt", "desc").executeTakeFirst();
      if (latest && Date.now() - latest.createdAt.getTime() < 60_000) {
        throw new OtpRequestError("Please wait before requesting another code.", 429);
      }

      const code = crypto.randomInt(100000, 999999).toString();
      const codeHash = crypto.createHash("sha256").update(`${code}:${process.env.JWT_SECRET}`).digest("hex");
      const row = await trx.insertInto("phoneVerificationCodes")
        .values({ userId: user.id, phoneNumber, codeHash, expiresAt: new Date(Date.now() + 5 * 60_000) })
        .returning(["id"])
        .executeTakeFirstOrThrow();

      await sendSms(
        phoneNumber,
        `Your NOLI Vendaz verification code is ${code}. It expires in 5 minutes.`,
        `NOLI-OTP-${row.id}`
      );

      // Only mutate the protected registered phone after rate limits passed and SMS delivery
      // succeeded. Any provider failure rolls this whole transaction back.
      if (customer) {
        if (phoneChanged) {
          customer = await trx.updateTable("vendingCustomers")
            .set({ phoneNumber, phoneVerifiedAt: null, updatedAt: new Date() })
            .where("id", "=", customer.id).returningAll().executeTakeFirstOrThrow();
        }
      } else {
        customer = await trx.insertInto("vendingCustomers")
          .values({ userId: user.id, phoneNumber }).returningAll().executeTakeFirstOrThrow();
      }
    });

    return new Response(superjson.stringify({ sent: true, retryAfterSeconds: 60 } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send verification code";
    if (error instanceof OtpRequestError) {
      return new Response(superjson.stringify({ error: message }), { status: error.status });
    }
    const dbCode = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    const status = message.toLowerCase().includes("auth") ? 401 : dbCode === "23505" ? 409 : 400;
    return new Response(superjson.stringify({ error: message }), { status });
  }
}
