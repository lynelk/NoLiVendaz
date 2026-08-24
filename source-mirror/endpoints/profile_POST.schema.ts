import { z } from "zod";
import superjson from "superjson";
import type { CustomerProfile } from "./profile_GET.schema";

export const schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional().default(""),
  lastName: z.string().trim().min(1).max(80),
  phoneNumber: z.string().trim().max(32).optional().default(""),
  identityType: z.enum(["NIN", "PASSPORT", "REFUGEE_ID", "ALIEN_ID", "DRIVER_LICENCE"]).nullable().optional().default(null),
  identityCountry: z.string().trim().min(2).max(3).optional().default("UG"),
  identityNumber: z.string().trim().max(32).optional().default(""),
  // Legacy alias accepted by older clients.
  nin: z.string().trim().max(32).optional().default(""),
  identityConsent: z.boolean(),
  termsAccepted: z.boolean(),
});
export type OutputType = { profile: CustomerProfile };

export async function postProfile(input: z.infer<typeof schema>, init?: RequestInit): Promise<OutputType> {
  const valid = schema.parse(input);
  const response = await fetch("/_api/profile", {
    method: "POST",
    body: superjson.stringify(valid),
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    const body = superjson.parse<{ error: string }>(await response.text());
    throw new Error(body.error);
  }
  return superjson.parse<OutputType>(await response.text());
}
