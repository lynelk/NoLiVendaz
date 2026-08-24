import superjson from "superjson";
import { nanoid } from "nanoid";
import { db } from "../../helpers/db";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { normalizePhoneNumber } from "../../helpers/normalizePhoneNumber";
import { asAmount, asNonNegativeInteger, getHostedStation } from "../../helpers/cpayVendingClient";
import { resolveVendingGatewayCapabilities } from "../../helpers/resolveVendingGatewayCapabilities";
import { buildCustomerProfile } from "../../helpers/customerProfileView";
import { schema, type OutputType } from "./rental_POST.schema";

export async function handle(request: Request) {
  try {
    const { user } = await getServerUserSession(request);
    const input = schema.parse(superjson.parse(await request.text()));
    let station = await db.selectFrom("vendingStations").selectAll().where("code", "=", input.stationCode).executeTakeFirst();
    if (!station) return new Response(superjson.stringify({ error: "Station not found" }), { status: 404 });

    const gateway = resolveVendingGatewayCapabilities({ stationCode: station.code, storedPublicToken: station.cpayPublicToken });
    if (gateway.publicToken) {
      try {
        const provider = await getHostedStation(gateway.publicToken);
        const providerCode = String(provider.deviceCode ?? "").trim();
        if (providerCode && providerCode !== station.code) {
          return new Response(superjson.stringify({ error: "This station's CPay vending token does not match the requested device. No rental was created." }), { status: 409 });
        }
        const providerState = String(provider.status ?? "").trim().toUpperCase();
        const online = ["ONLINE", "AVAILABLE"].includes(providerState);
        const rentableCount = asNonNegativeInteger(provider.availableCount);
        const liveValues = {
          status: (online ? (rentableCount > 0 ? "AVAILABLE" : "UNAVAILABLE") : "OFFLINE") as "AVAILABLE" | "UNAVAILABLE" | "OFFLINE",
          rentableCount,
          returnCapacityKnown: false,
          depositAmount: Math.max(0, asAmount(provider.depositAmount, station.depositAmount)),
          unitAmount: Math.max(0, asAmount(provider.unitPrice, station.unitAmount)),
          unitMinutes: Math.max(1, asNonNegativeInteger(provider.billingBlockMinutes, station.unitMinutes)),
          freeMinutes: asNonNegativeInteger(provider.freeMinutes, station.freeMinutes),
          minimumBillingBlocks: asNonNegativeInteger(provider.minimumBillingBlocks, station.minimumBillingBlocks),
          dailyMaxAmount: Math.max(0, asAmount(provider.dailyCapAmount, station.dailyMaxAmount)),
          overtimeAmount: Math.max(0, asAmount(provider.overtimeAmount, station.overtimeAmount)),
          overtimeDays: asNonNegativeInteger(provider.overtimeDays, station.overtimeDays),
          maxRentalQuantity: 1,
          updatedAt: new Date(),
        };
        await db.updateTable("vendingStations").set(liveValues).where("id", "=", station.id).execute();
        station = { ...station, ...liveValues };
      } catch (error) {
        const message = error instanceof Error ? error.message : "CPay could not confirm live station availability.";
        return new Response(superjson.stringify({ error: `Live station verification failed: ${message}. No payment was started.` }), { status: 503 });
      }
    }

    if (station.status !== "AVAILABLE" || station.rentableCount < 1) {
      return new Response(superjson.stringify({ error: "This station cannot start a rental right now" }), { status: 409 });
    }
    const allowedQuantity = Math.min(station.maxRentalQuantity, station.rentableCount);
    if (input.quantity > allowedQuantity) {
      return new Response(superjson.stringify({ error: `This location allows up to ${allowedQuantity} power bank${allowedQuantity === 1 ? "" : "s"} right now.` }), { status: 409 });
    }

    const customer = await db.selectFrom("vendingCustomers").selectAll().where("userId", "=", user.id).executeTakeFirst();
    if (!customer) return new Response(superjson.stringify({ error: "Complete your NOLI Vendaz customer profile before renting." }), { status: 403 });
    const access = buildCustomerProfile(customer);
    if (!access.serviceAccessReady) {
      return new Response(superjson.stringify({
        error: "Phone and identity verification are required before starting this rental.",
        missingRequirements: access.serviceAccessMissing,
      }), { status: 403 });
    }
    if (!customer.phoneNumber) {
      return new Response(superjson.stringify({ error: "Link and verify a registered phone before renting." }), { status: 403 });
    }
    if (normalizePhoneNumber(customer.phoneNumber) !== normalizePhoneNumber(input.phoneNumber)) {
      return new Response(superjson.stringify({ error: "Rental registration must use your verified account phone number." }), { status: 403 });
    }

    const activeRental = await db.selectFrom("vendingRentals")
      .selectAll()
      .where("customerId", "=", customer.id)
      .where("status", "not in", ["COMPLETED", "CANCELLED"])
      .orderBy("createdAt", "desc")
      .executeTakeFirst();

    if (activeRental && activeRental.status === "PAYMENT_REQUIRED" && activeRental.stationId !== station.id) {
      return new Response(superjson.stringify({ error: `You already have an unfinished rental ${activeRental.reference}. Cancel that unpaid rental from Activity before starting at another station.` }), { status: 409 });
    }
    if (activeRental && activeRental.status === "PAYMENT_REQUIRED" && activeRental.quantity !== input.quantity) {
      return new Response(superjson.stringify({ error: `Rental ${activeRental.reference} was created for ${activeRental.quantity} power bank${activeRental.quantity === 1 ? "" : "s"}. Cancel it from Activity before changing quantity.` }), { status: 409 });
    }
    if (activeRental && activeRental.status !== "PAYMENT_REQUIRED") {
      return new Response(superjson.stringify({ error: `Rental ${activeRental.reference} is still open. Resume or resolve that rental before starting another one.` }), { status: 409 });
    }

    let rental = activeRental;
    if (!rental) {
      try {
        rental = await db.insertInto("vendingRentals").values({
          reference: `VR-${nanoid(10).toUpperCase()}`,
          customerId: customer.id,
          stationId: station.id,
          quantity: input.quantity,
          depositAmount: station.depositAmount * input.quantity,
          currency: station.currency,
          unitAmount: station.unitAmount,
          unitMinutes: station.unitMinutes,
          freeMinutes: station.freeMinutes,
          minimumBillingBlocks: station.minimumBillingBlocks,
          dailyMaxAmount: station.dailyMaxAmount,
          overtimeAmount: station.overtimeAmount,
          overtimeDays: station.overtimeDays,
          estimatedRefund: station.depositAmount * input.quantity,
          refundPhoneNumber: customer.phoneNumber,
          status: "PAYMENT_REQUIRED",
        }).returningAll().executeTakeFirstOrThrow();
      } catch (error) {
        const dbCode = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
        if (dbCode !== "23505") throw error;
        const concurrentDraft = await db.selectFrom("vendingRentals").selectAll()
          .where("customerId", "=", customer.id).where("status", "=", "PAYMENT_REQUIRED")
          .orderBy("createdAt", "desc").executeTakeFirst();
        if (!concurrentDraft || concurrentDraft.stationId !== station.id || concurrentDraft.quantity !== input.quantity) {
          return new Response(superjson.stringify({ error: "Another checkout was created at the same time. Open Activity and continue the existing unpaid rental." }), { status: 409 });
        }
        rental = concurrentDraft;
      }
    }

    const output: OutputType = { rental: {
      reference: rental.reference,
      status: rental.status,
      depositAmount: rental.depositAmount,
      estimatedCharge: rental.estimatedCharge,
      estimatedRefund: rental.estimatedRefund,
      assetDisplayId: rental.assetDisplayId,
      startedAt: rental.startedAt,
      returnedAt: rental.returnedAt,
      refundAmount: rental.refundAmount,
      refundStatus: rental.refundStatus,
      quantity: rental.quantity,
      paymentMethod: rental.paymentMethod,
      paymentPhoneNumber: rental.paymentPhoneNumber,
      refundPhoneNumber: rental.refundPhoneNumber,
      paymentCardLast4: rental.paymentCardLast4,
      paymentLastError: rental.paymentLastError,
      returnIntent: null,
      pricing: {
        currency: rental.currency,
        unitAmount: rental.unitAmount,
        unitMinutes: rental.unitMinutes,
        freeMinutes: rental.freeMinutes,
        minimumBillingBlocks: rental.minimumBillingBlocks,
        dailyMaxAmount: rental.dailyMaxAmount,
        overtimeAmount: rental.overtimeAmount,
        overtimeDays: rental.overtimeDays,
      },
      station: { code: station.code, name: station.name, detail: station.detail },
    }};
    return new Response(superjson.stringify(output));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create rental";
    return new Response(superjson.stringify({ error: message }), { status: message.toLowerCase().includes("auth") ? 401 : 400 });
  }
}
