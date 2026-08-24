import { evaluateServiceAccess } from "./serviceAccessPolicy";

describe("protected service access", () => {
  it("allows account setup to exist separately from rental eligibility", () => {
    const result = evaluateServiceAccess({ profileSetupComplete: true, phoneVerified: false, identityVerificationStatus: "NOT_SUBMITTED", identityConfigured: false, identityConsentAccepted: false, termsAccepted: true });
    expect(result.allowed).toBeFalse();
    expect(result.missing).toContain("PHONE_VERIFICATION");
    expect(result.missing).toContain("IDENTITY_VERIFICATION");
  });
  it("allows the rental only after phone and identity verification", () => {
    expect(evaluateServiceAccess({ profileSetupComplete: true, phoneVerified: true, identityVerificationStatus: "VERIFIED", identityConfigured: true, identityConsentAccepted: true, termsAccepted: true }).allowed).toBeTrue();
  });
});
