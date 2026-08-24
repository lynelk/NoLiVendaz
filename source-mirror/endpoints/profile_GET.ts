import superjson from "superjson";
import { db } from "../helpers/db";
import { getServerUserSession } from "../helpers/getServerUserSession";
import { buildCustomerProfile } from "../helpers/customerProfileView";
import type { OutputType } from "./profile_GET.schema";

export async function handle(request: Request) {
  const noStore = { "Cache-Control": "private, no-store, max-age=0" };
  try {
    const { user } = await getServerUserSession(request);
    const row = await db.selectFrom("vendingCustomers").selectAll().where("userId", "=", user.id).executeTakeFirst();
    if (!row) return new Response(superjson.stringify({ profile: null } satisfies OutputType), { headers: noStore });
    const profile = buildCustomerProfile(row);
    return new Response(superjson.stringify({ profile } satisfies OutputType), { headers: noStore });
  } catch {
    return new Response(superjson.stringify({ error: "Authentication required" }), { status: 401, headers: noStore });
  }
}
