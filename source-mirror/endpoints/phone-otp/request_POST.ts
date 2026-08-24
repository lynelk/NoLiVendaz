import crypto from "crypto";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { normalizePhoneNumber } from "../../helpers/normalizePhoneNumber";
import { sendSms } from "../../helpers/sendSms";
import { schema, type OutputType } from "./request_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    const phoneNumber = normalizePhoneNumber(input.phoneNumber);
    let customer = await db.selectFrom("vendingCustomers").selectAll().where("userId", "=", user.id).executeTakeFirst();
    if (customer?.phoneNumber && normalizePhoneNumber(customer.phoneNumber) === phoneNumber && customer.phoneVerifiedAt) {
      return new Response(superjson.stringify({ error: "This registered phone is already verified." }), { status: 409 });
    }
    const phoneOwner = await db.selectFrom("vendingCustomers").select(["id"]).where("phoneNumber", "=", phoneNumber).executeTakeFirst();
    if (phoneOwner && phoneOwner.id !== customer?.id) {
      return new Response(superjson.stringify({ error: "This phone number is already linked to another NOLI Vendaz account." }), { status: 409 });
    }

    const phoneChanged = customer?.phoneNumber !== phoneNumber;
    if (customer && phoneChanged) {
      const openRental = await db.selectFrom("vendingRentals").select(["reference"])
        .where("customerId", "=", customer.id).where("status", "not in", ["COMPLETED", "CANCELLED"])
        .executeTakeFirst();
      if (openRental) {
        return new Response(superjson.stringify({ error: `Resolve open rental ${openRental.reference} before changing your registered phone.` }), { status: 409 });
      }
    }

    if (customer) {
      if (phoneChanged) {
        customer = await db.updateTable("vendingCustomers").set({ phoneNumber, phoneVerifiedAt: null, updatedAt: new Date() })
          .where("id", "=", customer.id).returningAll().executeTakeFirstOrThrow();
      }
    } else {
      customer = await db.insertInto("vendingCustomers").values({ userId: user.id, phoneNumber }).returningAll().executeTakeFirstOrThrow();
    }
    const oneHourAgo = new Date(Date.now() - 60 * 60_000);
    const [userWindow, phoneWindow] = await Promise.all([
      db.selectFrom("phoneVerificationCodes").select(({ fn }) => fn.countAll<number>().as("count"))
        .where("userId", "=", user.id).where("createdAt", ">=", oneHourAgo).executeTakeFirstOrThrow(),
      db.selectFrom("phoneVerificationCodes").select(({ fn }) => fn.countAll<number>().as("count"))
        .where("phoneNumber", "=", phoneNumber).where("createdAt", ">=", oneHourAgo).executeTakeFirstOrThrow(),
    ]);
    if (Number(userWindow.count) >= 6 || Number(phoneWindow.count) >= 4) {
      return new Response(superjson.stringify({ error: "Too many verification codes have been sent recently. Wait before requesting another SMS." }), { status: 429 });
    }
    const latestForUser = await db.selectFrom("phoneVerificationCodes").select(["createdAt"])
      .where("userId", "=", user.id).orderBy("createdAt", "desc").executeTakeFirst();
    if (latestForUser && Date.now() - latestForUser.createdAt.getTime() < 30_000) {
      return new Response(superjson.stringify({ error: "Please wait before requesting another verification code." }), { status: 429 });
    }
    const latest = await db.selectFrom("phoneVerificationCodes").selectAll()
      .where("userId", "=", user.id).where("phoneNumber", "=", phoneNumber)
      .orderBy("createdAt", "desc").executeTakeFirst();
    if (latest && Date.now() - latest.createdAt.getTime() < 60_000) {
      return new Response(superjson.stringify({ error: "Please wait before requesting another code." }), { status: 429 });
    }

    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash("sha256").update(`${code}:${process.env.JWT_SECRET}`).digest("hex");
    const row = await db.insertInto("phoneVerificationCodes")
      .values({ userId: user.id, phoneNumber, codeHash, expiresAt: new Date(Date.now() + 5 * 60_000) })
      .returning(["id"])
      .executeTakeFirstOrThrow();
    try {
      await sendSms(
        phoneNumber,
        `Your NOLI Vendaz verification code is ${code}. It expires in 5 minutes.`,
        `NOLI-OTP-${row.id}`
      );
    } catch (error) {
      await db.deleteFrom("phoneVerificationCodes").where("id", "=", row.id).execute();
      throw error;
    }
    return new Response(superjson.stringify({ sent: true, retryAfterSeconds: 60 } satisfies OutputType));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send verification code";
    return new Response(superjson.stringify({ error: message }), { status: 400 });
  }
}
