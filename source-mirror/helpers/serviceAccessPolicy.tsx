export type ProtectedService = "POWER_BANK_RENTAL";

export type ServiceAccessProfile = {
  profileSetupComplete: boolean;
  phoneVerified: boolean;
  identityVerificationStatus: string;
  identityConfigured: boolean;
  identityConsentAccepted: boolean;
  termsAccepted: boolean;
};

export function evaluateServiceAccess(profile: ServiceAccessProfile | null | undefined, service: ProtectedService = "POWER_BANK_RENTAL") {
  if (!profile) return { allowed: false, missing: ["PROFILE"] as string[], service };
  const missing: string[] = [];
  if (!profile.profileSetupComplete) missing.push("PROFILE");
  if (!profile.termsAccepted) missing.push("TERMS");
  if (!profile.phoneVerified) missing.push("PHONE_VERIFICATION");
  if (!profile.identityConfigured) missing.push("IDENTITY");
  if (!profile.identityConsentAccepted) missing.push("IDENTITY_CONSENT");
  if (profile.identityVerificationStatus !== "VERIFIED") missing.push("IDENTITY_VERIFICATION");
  return { allowed: missing.length === 0, missing, service };
}
