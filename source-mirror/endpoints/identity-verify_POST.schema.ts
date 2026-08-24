import { z } from "zod";
import superjson from "superjson";

export const schema = z.object({ identityType: z.enum(["NIN", "PASSPORT", "REFUGEE_ID", "ALIEN_ID", "DRIVER_LICENCE"]), identityCountry: z.string().trim().min(2).max(3).default("UG"), identityNumber: z.string().trim().min(5).max(32) });
export type OutputType = { status: "VERIFICATION_FAILED" | "VERIFICATION_PENDING" | "VERIFIED" | "REVIEW_REQUIRED"; message: string; requestReference?: string; };
export async function postIdentityVerify(input: z.infer<typeof schema>, init?: RequestInit): Promise<OutputType> {
  const valid = schema.parse(input);
  const response = await fetch("/_api/identity-verify", { method: "POST", body: superjson.stringify(valid), ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = superjson.parse<OutputType & { error?: string }>(await response.text());
  if (!response.ok) throw new Error(body.error || "Identity verification failed");
  return body;
}
