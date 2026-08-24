import crypto from "node:crypto";
import type { IdentityDocumentType } from "./identityTypes";

export function fingerprintIdentity(type: IdentityDocumentType, country: string, normalizedIdentityNumber: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Identity fingerprinting is not configured.");
  const key = crypto.createHmac("sha256", secret).update("NOLI_IDENTITY_FINGERPRINT_V1").digest();
  const material = `${country.trim().toUpperCase()}:${type}:${normalizedIdentityNumber.trim().toUpperCase()}`;
  return crypto.createHmac("sha256", key).update(material).digest("hex");
}
