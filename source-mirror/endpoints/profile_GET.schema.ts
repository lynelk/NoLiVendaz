import superjson from "superjson";

export type CustomerProfile = {
  firstName: string;
  middleName: string;
  lastName: string;
  phoneNumber: string;
  phoneVerified: boolean;
  identityType: "NIN" | "PASSPORT" | "REFUGEE_ID" | "ALIEN_ID" | "DRIVER_LICENCE" | null;
  identityCountry: string;
  identityMasked: string;
  identityConfigured: boolean;
  identityVerificationStatus: "NOT_SUBMITTED" | "FORMAT_VALID" | "VERIFICATION_PENDING" | "VERIFIED" | "VERIFICATION_FAILED" | "REVIEW_REQUIRED";
  identityVerificationReference: string | null;
  identityVerifiedAt: Date | null;
  /** Kept for backward response compatibility. Full NIN values are never returned. */
  nin: string;
  ninMasked: string;
  ninConfigured: boolean;
  ninVerificationStatus: "NOT_SUBMITTED" | "FORMAT_VALID" | "PENDING_REGISTRY" | "VERIFIED" | "FAILED";
  identityConsentAccepted: boolean;
  termsAccepted: boolean;
  consentVersion: string | null;
  profileSetupComplete: boolean;
  serviceAccessReady: boolean;
  serviceAccessMissing: string[];
  registrationComplete: boolean;
};

export type OutputType = { profile: CustomerProfile | null };

export async function getProfile(init?: RequestInit): Promise<OutputType> {
  const response = await fetch("/_api/profile", { method: "GET", ...init });
  if (!response.ok) throw new Error("Unable to load your profile.");
  return superjson.parse<OutputType>(await response.text());
}
