import { isCpayPrivateApiConfigured, verifyCpayIdentity } from "./cpayClient";
import { validateIdentityDocument, type IdentityDocumentType } from "./identityTypes";

export type IdentityRegistryResult = { status: "VERIFICATION_FAILED" | "VERIFICATION_PENDING" | "VERIFIED" | "REVIEW_REQUIRED"; message: string; requestReference?: string; };
export type IdentityVerificationContext = { fullName?: string | null; msisdn?: string | null; consentGranted?: boolean; };

export async function verifyIdentityWithRegistry(identityType: IdentityDocumentType, identityNumber: string, country = "UG", context: IdentityVerificationContext = {}): Promise<IdentityRegistryResult> {
  const check = validateIdentityDocument(identityType, identityNumber, country);
  if (!check.formatValid) return { status: "VERIFICATION_FAILED", message: check.message };
  if (!isCpayPrivateApiConfigured()) return { status: "VERIFICATION_PENDING", message: `${identityType} format is valid. Back-end verification is awaiting the CPay Identity service connection.` };
  if (context.consentGranted !== true) return { status: "VERIFICATION_PENDING", message: "Identity verification consent is required before this identification number can be sent to CPay Identity." };
  let data;
  try {
    data = await verifyCpayIdentity({ identityType, identityNumber: check.normalized, country: check.country, ...(identityType === "NIN" ? { nin: check.normalized } : {}), fullName: context.fullName, msisdn: context.msisdn, consentGranted: true, requestedBy: "NOLI_VENDAZ" });
  } catch (error) {
    console.warn("CPay Identity request unavailable", { identityType, errorType: error instanceof Error ? error.name : "unknown" });
    throw new Error("The identity verification service is temporarily unavailable. Your identification document has not been marked verified.");
  }
  const rawStatus = String(data.status ?? "").trim().toUpperCase();
  if (rawStatus === "VERIFIED") return { status: "VERIFIED", message: `${identityType} verified through CPay Identity.`, requestReference: data.requestReference };
  if (["FAILED", "INVALID", "REJECTED", "NOT_FOUND", "MISMATCH", "NO_MATCH", "NOT_VERIFIED"].includes(rawStatus)) return { status: "VERIFICATION_FAILED", message: "The configured identity provider could not verify this identification document.", requestReference: data.requestReference };
  if (["REVIEW_REQUIRED", "MANUAL_REVIEW", "IN_REVIEW"].includes(rawStatus)) return { status: "REVIEW_REQUIRED", message: "Identity verification needs additional review before protected services can be used.", requestReference: data.requestReference };
  return { status: "VERIFICATION_PENDING", message: "Identity verification is still pending through CPay Identity.", requestReference: data.requestReference };
}
