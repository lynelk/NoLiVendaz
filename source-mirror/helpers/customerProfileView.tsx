import type { Selectable } from "kysely";
import type { VendingCustomers } from "./schema";
import { consentVersion } from "./consentVersion";
import { evaluateServiceAccess } from "./serviceAccessPolicy";

type CustomerRow = Selectable<VendingCustomers>;

function legacyNinStatus(status: CustomerRow["identityVerificationStatus"]): CustomerRow["ninVerificationStatus"] {
  if (status === "VERIFIED") return "VERIFIED";
  if (status === "VERIFICATION_FAILED" || status === "REVIEW_REQUIRED") return "FAILED";
  if (status === "VERIFICATION_PENDING") return "PENDING_REGISTRY";
  if (status === "FORMAT_VALID") return "FORMAT_VALID";
  return "NOT_SUBMITTED";
}

export function buildCustomerProfile(row: CustomerRow) {
  const termsAccepted = Boolean(row.termsAcceptedAt && row.consentVersion === consentVersion);
  const identityConsentAccepted = Boolean(row.identityConsentAt && row.consentVersion === consentVersion);
  const identityConfigured = Boolean(row.identityType && row.identityNumberFingerprint);
  const profileSetupComplete = Boolean(row.firstName && row.lastName && termsAccepted);
  const base = {
    profileSetupComplete,
    phoneVerified: Boolean(row.phoneVerifiedAt),
    identityVerificationStatus: row.identityVerificationStatus,
    identityConfigured,
    identityConsentAccepted,
    termsAccepted,
  };
  const serviceAccess = evaluateServiceAccess(base);
  const identityMasked = row.identityNumberLastFour ? `${"•".repeat(6)}${row.identityNumberLastFour}` : "";
  const isNin = row.identityType === "NIN";

  return {
    firstName: row.firstName ?? "",
    middleName: row.middleName ?? "",
    lastName: row.lastName ?? "",
    phoneNumber: row.phoneNumber ?? "",
    phoneVerified: Boolean(row.phoneVerifiedAt),
    identityType: row.identityType,
    identityCountry: row.identityCountry ?? "UG",
    identityMasked,
    identityConfigured,
    identityVerificationStatus: row.identityVerificationStatus,
    identityVerificationReference: row.identityVerificationReference,
    identityVerifiedAt: row.identityVerifiedAt,
    // Legacy NIN response aliases retained for older native/web clients.
    nin: "",
    ninMasked: isNin ? identityMasked : "",
    ninConfigured: Boolean(isNin && identityConfigured),
    ninVerificationStatus: isNin ? legacyNinStatus(row.identityVerificationStatus) : "NOT_SUBMITTED" as const,
    identityConsentAccepted,
    termsAccepted,
    consentVersion: row.consentVersion,
    profileSetupComplete,
    serviceAccessReady: serviceAccess.allowed,
    serviceAccessMissing: serviceAccess.missing,
    registrationComplete: profileSetupComplete,
  };
}
