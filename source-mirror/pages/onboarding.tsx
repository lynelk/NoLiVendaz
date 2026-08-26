import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, IdCard, Phone, ShieldCheck, Zap } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Checkbox } from "../components/Checkbox";
import { Input } from "../components/Input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/Select";
import { useAuth } from "../helpers/useAuth";
import { useCustomerProfile } from "../helpers/useCustomerProfile";
import { getIdentityTypeDefinition, identityTypeDefinitions, validateIdentityDocument, type IdentityDocumentType } from "../helpers/identityTypes";
import { sanitizeResumePath } from "../helpers/sanitizeResumePath";
import styles from "./onboarding.module.css";

function localUgandaPhone(value: string | null | undefined) {
  const compact = (value ?? "").replace(/\D/g, "");
  if (compact.startsWith("256") && compact.length === 12) return compact.slice(3);
  if (compact.startsWith("0") && compact.length === 10) return compact.slice(1);
  return compact.slice(-9);
}

function serviceRequirementLabel(missing: string[]) {
  const labels: Record<string, string> = {
    PROFILE: "complete your basic profile",
    TERMS: "accept the current Terms and Privacy Notice",
    PHONE_VERIFICATION: "verify your registered phone",
    IDENTITY: "add an accepted identification document",
    IDENTITY_CONSENT: "accept identity-verification consent",
    IDENTITY_VERIFICATION: "verify your identification document through CPay Identity",
  };
  return missing.map((item) => labels[item] ?? item).join(", ");
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const profile = useCustomerProfile(authState.type === "authenticated");
  const params = new URLSearchParams(window.location.search);
  const resumePath = sanitizeResumePath(params.get("resume"));
  const protectedServiceRequired = params.get("required") === "POWER_BANK_RENTAL";
  const existing = profile.profileQuery.data?.profile;

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [identityType, setIdentityType] = useState<IdentityDocumentType>("NIN");
  const [identityCountry, setIdentityCountry] = useState("UG");
  const [identityNumber, setIdentityNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [identityConsent, setIdentityConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const identityDefinition = getIdentityTypeDefinition(identityType);
  const identityCheck = useMemo(
    () => validateIdentityDocument(identityType, identityNumber, identityCountry),
    [identityType, identityNumber, identityCountry],
  );
  const phoneNumber = phoneLocal ? `+256${phoneLocal}` : "";
  const phoneFormatValid = phoneLocal.length === 9 && /^\d{9}$/.test(phoneLocal);
  const identityCapabilities = profile.identityCapabilitiesQuery.data;
  const synchronousIdentityProvider = identityCapabilities?.providers.find((provider) =>
    provider.supportsSync
    && provider.supportedIdentityTypes.includes(identityType)
    && (provider.supportedCountries.length === 0 || provider.supportedCountries.includes(identityCountry.toUpperCase()))
  );
  const identityCoverageKnown = profile.identityCapabilitiesQuery.isSuccess;
  const identityVerificationAvailable = Boolean(identityCapabilities?.configured && synchronousIdentityProvider);
  const identityVerificationBlocked = identityCoverageKnown && !identityVerificationAvailable;

  useEffect(() => {
    if (authState.type === "unauthenticated") navigate("/login", { replace: true });
  }, [authState.type, navigate]);

  useEffect(() => {
    if (!existing) return;
    setFirstName(existing.firstName);
    setMiddleName(existing.middleName);
    setLastName(existing.lastName);
    setPhoneLocal(localUgandaPhone(existing.phoneNumber));
    setIdentityType(existing.identityType ?? "NIN");
    setIdentityCountry(existing.identityCountry || "UG");
    setIdentityConsent(existing.identityConsentAccepted);
    setTermsAccepted(existing.termsAccepted);
  }, [existing]);

  const save = async () => {
    setMessage(null);
    try {
      await profile.saveProfile.mutateAsync({
        firstName,
        middleName,
        lastName,
        phoneNumber: phoneFormatValid ? phoneNumber : "",
        identityType: identityNumber.trim() || existing?.identityConfigured ? identityType : null,
        identityCountry,
        identityNumber,
        nin: "",
        identityConsent,
        termsAccepted,
      });
      setMessage("Profile saved. Phone and identity verification can be completed now or when a protected service requires them.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save profile.");
    }
  };

  const sendCode = async () => {
    setMessage(null);
    if (!phoneFormatValid) {
      setMessage("Enter the 9 digits after +256 before requesting a verification code.");
      return;
    }
    try {
      await profile.requestOtp.mutateAsync({ phoneNumber });
      await profile.profileQuery.refetch();
      setMessage("Verification code sent through CPay Communications.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send SMS.");
    }
  };

  const verifyPhone = async () => {
    setMessage(null);
    try {
      await profile.verifyOtp.mutateAsync({ phoneNumber, code: otp });
      setMessage("Registered phone verified.");
      setOtp("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Phone verification failed.");
    }
  };

  const verifyIdentity = async () => {
    setMessage(null);
    if (identityVerificationBlocked) {
      setMessage(identityCapabilities?.configured
        ? `${identityDefinition.shortLabel} can be saved now, but no synchronous CPay Identity provider currently covers ${identityCountry.toUpperCase()} for this document type.`
        : "CPay Identity verification is not configured for this NOLI environment yet. You can save the document now and verify it later.");
      return;
    }
    if (!identityCheck.formatValid) {
      setMessage(identityCheck.message);
      return;
    }
    if (!identityConsent) {
      setMessage("Accept the identity-verification consent before sending identification data to CPay Identity.");
      return;
    }
    if (!termsAccepted || !firstName.trim() || !lastName.trim()) {
      setMessage("Save your name and accept the current Terms and Privacy Notice before identity verification.");
      return;
    }
    try {
      await profile.saveProfile.mutateAsync({
        firstName,
        middleName,
        lastName,
        phoneNumber: phoneFormatValid ? phoneNumber : "",
        identityType,
        identityCountry,
        identityNumber,
        nin: "",
        identityConsent,
        termsAccepted,
      });
      const result = await profile.verifyIdentity.mutateAsync({ identityType, identityCountry, identityNumber });
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Identity verification failed.");
    }
  };

  const latest = profile.profileQuery.data?.profile;
  const identityInputValid = !identityNumber.trim() || identityCheck.formatValid;
  const phoneInputValid = !phoneLocal || phoneFormatValid;
  const canSave = Boolean(firstName.trim() && lastName.trim() && termsAccepted && identityInputValid && phoneInputValid);
  const serviceReady = Boolean(latest?.serviceAccessReady);
  const canFinish = protectedServiceRequired ? serviceReady : Boolean(latest?.profileSetupComplete);
  const finishLabel = protectedServiceRequired ? "Continue to rental" : "Finish setup";
  const selectedIdentityLabel = getIdentityTypeDefinition(latest?.identityType ?? identityType).shortLabel;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}><span><Zap size={17}/></span>NOLI <b>Vendaz</b></div>
        <Badge variant={serviceReady ? "success" : "secondary"}>{serviceReady ? "Rental ready" : "Progressive setup"}</Badge>
      </header>

      <section className={styles.intro}>
        <p>ACCOUNT & IDENTITY</p>
        <h1>Set up now. Verify when needed.</h1>
        <span>You can save your basic profile without verifying a phone or ID. NOLI requires the missing checks only before a protected service, such as starting a rental.</span>
      </section>

      {protectedServiceRequired && !serviceReady && latest && (
        <div className={styles.requirementBanner} role="status">
          <ShieldCheck size={19}/>
          <div><strong>Verification required for this rental</strong><span>To continue, {serviceRequirementLabel(latest.serviceAccessMissing)}.</span></div>
        </div>
      )}

      <div className={styles.sections}>
        <section className={styles.card}>
          <div className={styles.sectionTitle}><span>1</span><div><h2>Your name</h2><p>Use the names printed on the identification document you intend to verify.</p></div></div>
          <label>First name<Input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" /></label>
          <label>Middle name <small>Optional</small><Input value={middleName} onChange={(event) => setMiddleName(event.target.value)} autoComplete="additional-name" /></label>
          <label>Last name<Input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" /></label>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionTitle}><span>2</span><div><h2>Link a phone</h2><p>Optional now. A verified phone is required before your first rental and remains the protected refund destination.</p></div></div>
          <label>Mobile number
            <div className={styles.phoneRow}><span className={styles.phonePrefix}>+256</span><Input value={phoneLocal} onChange={(event) => setPhoneLocal(event.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" autoComplete="tel-national" placeholder="7XXXXXXXX" /></div>
          </label>
          {phoneLocal && <div className={phoneFormatValid ? styles.valid : styles.hint}><Phone size={17}/>{phoneFormatValid ? `Will be linked as ${phoneNumber}` : "Enter exactly 9 digits after +256."}</div>}
          {latest?.phoneVerified && latest.phoneNumber === phoneNumber && <div className={styles.valid}><CheckCircle2 size={17}/> Registered phone verified</div>}
          <div className={styles.verificationBlock}>
            <div><strong>SMS verification</strong><small>{latest?.phoneVerified && latest.phoneNumber === phoneNumber ? "Verified" : "Optional until you access a protected service"}</small></div>
            <Button variant="secondary" onClick={sendCode} disabled={!phoneFormatValid || profile.requestOtp.isPending || Boolean(latest?.phoneVerified && latest.phoneNumber === phoneNumber)}>{latest?.phoneVerified && latest.phoneNumber === phoneNumber ? "Phone verified" : profile.requestOtp.isPending ? "Sending..." : "Send SMS code"}</Button>
          </div>
          {!(latest?.phoneVerified && latest.phoneNumber === phoneNumber) && otp !== undefined && (
            <div className={styles.verifyRow}>
              <Input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" inputMode="numeric" />
              <Button onClick={verifyPhone} disabled={!phoneFormatValid || otp.length !== 6 || profile.verifyOtp.isPending}>{profile.verifyOtp.isPending ? "Verifying..." : "Verify phone"}</Button>
            </div>
          )}
        </section>

        <section className={styles.card}>
          <div className={styles.sectionTitle}><span>3</span><div><h2>Identification</h2><p>Choose the document you have. Validation checks the format; verification confirms it through CPay and the configured provider.</p></div></div>
          <label>Identification type
            <Select value={identityType} onValueChange={(value) => { setIdentityType(value as IdentityDocumentType); setIdentityNumber(""); setMessage(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{identityTypeDefinitions.map((definition) => <SelectItem key={definition.type} value={definition.type}>{definition.label}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label>{identityDefinition.label}
            <Input value={identityNumber} maxLength={identityDefinition.maxLength} onChange={(event) => setIdentityNumber(event.target.value.toUpperCase().replace(/\s/g, ""))} placeholder={existing?.identityConfigured && existing.identityType === identityType ? `Re-enter ${identityDefinition.shortLabel} to verify or change` : identityDefinition.placeholder} />
          </label>
          {existing?.identityConfigured && existing.identityType === identityType && !identityNumber.trim() && <div className={styles.valid}><ShieldCheck size={17}/> Saved securely as {existing.identityMasked}. NOLI does not store the full identification number.</div>}
          {identityNumber.trim() && <div className={identityCheck.formatValid ? styles.valid : styles.hint}><IdCard size={17}/>{identityCheck.message}</div>}
          <div className={styles.validationExplainer}><strong>Validation</strong><span>Local format and length check. This never means the document is verified.</span><strong>Verification</strong><span>Back-end confirmation through CPay Identity and the provider configured for the selected ID type.</span></div>
          {profile.identityCapabilitiesQuery.isPending && <div className={styles.registry}><Badge variant="secondary">Checking provider coverage</Badge><p>NOLI is checking which identification documents CPay can verify for this market.</p></div>}
          {profile.identityCapabilitiesQuery.isError && <div className={styles.registry}><Badge variant="warning">Coverage check unavailable</Badge><p>You can still save this document. Verification will be confirmed by CPay when you attempt it.</p></div>}
          {identityCoverageKnown && !identityCapabilities?.configured && <div className={styles.registry}><Badge variant="warning">Verification connection pending</Badge><p>You can save this document now. Authoritative verification becomes available when NOLI's CPay Identity service credentials are configured.</p></div>}
          {identityCoverageKnown && identityCapabilities?.configured && identityVerificationAvailable && <div className={styles.valid}><CheckCircle2 size={17}/> CPay has a synchronous verification provider for this document type and country.</div>}
          {identityCoverageKnown && identityCapabilities?.configured && !identityVerificationAvailable && <div className={styles.registry}><Badge variant="warning">Save only for now</Badge><p>No synchronous CPay Identity provider currently covers {identityDefinition.shortLabel} in {identityCountry.toUpperCase()}. Local validation is still available, but protected services remain blocked until authoritative verification becomes available.</p></div>}
          {latest?.identityVerificationStatus === "VERIFICATION_PENDING" && <div className={styles.registry}><Badge variant="warning">Verification pending</Badge><p>CPay accepted the verification flow, but no authoritative verified result has been recorded yet.</p></div>}
          {latest?.identityVerificationStatus === "VERIFIED" && <div className={styles.valid}><CheckCircle2 size={17}/> {selectedIdentityLabel} verified through CPay Identity</div>}
          {latest?.identityVerificationStatus === "VERIFICATION_FAILED" && <div className={styles.registry}><Badge variant="destructive">Could not verify</Badge><p>Check the selected ID type and number against the physical document before trying again.</p></div>}
          {latest?.identityVerificationStatus === "REVIEW_REQUIRED" && <div className={styles.registry}><Badge variant="warning">Review required</Badge><p>Automated verification was inconclusive. Protected services remain unavailable until the verification is resolved.</p></div>}
        </section>

        <section className={styles.card}>
          <div className={styles.sectionTitle}><span>4</span><div><h2>Privacy & verification consent</h2><p>Terms are required for account setup. Identity consent is required only before identity data is sent to CPay for verification.</p></div></div>
          <label className={styles.consentRow}>
            <Checkbox checked={identityConsent} onChange={(event) => setIdentityConsent(event.target.checked)} />
            <span>I authorize NOLI Vendaz to use the names and identification number I provide for identity verification through CPay and its configured verification provider.</span>
          </label>
          <label className={styles.consentRow}>
            <Checkbox checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
            <span>I accept the current <Link to="/terms">Customer Terms</Link> and acknowledge the <Link to="/privacy">Privacy Notice</Link>.</span>
          </label>
          <div className={styles.hint}><ShieldCheck size={17}/>Camera and location permissions are requested separately only when you use those features. Payment, communications and identity-provider routing are handled through CPay.</div>
          <div className={styles.actionRow}>
            <Button variant="outline" onClick={save} disabled={!canSave || profile.saveProfile.isPending}>{profile.saveProfile.isPending ? "Saving..." : "Save profile"}</Button>
            <Button onClick={verifyIdentity} disabled={!identityCheck.formatValid || !identityConsent || !termsAccepted || profile.verifyIdentity.isPending || identityVerificationBlocked}>{profile.verifyIdentity.isPending ? "Checking provider..." : identityVerificationBlocked ? "Verification unavailable" : `Verify ${identityDefinition.shortLabel}`}</Button>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.sectionTitle}><span>5</span><div><h2>Readiness</h2><p>Your account can exist before verification. Protected services enforce their own required checks when you try to use them.</p></div></div>
          <div className={styles.readinessGrid}>
            <div><span>Basic profile</span><Badge variant={latest?.profileSetupComplete ? "success" : "warning"}>{latest?.profileSetupComplete ? "Ready" : "Incomplete"}</Badge></div>
            <div><span>Phone</span><Badge variant={latest?.phoneVerified ? "success" : "secondary"}>{latest?.phoneVerified ? "Verified" : "Optional now"}</Badge></div>
            <div><span>Identification</span><Badge variant={latest?.identityVerificationStatus === "VERIFIED" ? "success" : "secondary"}>{latest?.identityVerificationStatus === "VERIFIED" ? "Verified" : latest?.identityConfigured ? "Saved" : "Optional now"}</Badge></div>
            <div><span>Power-bank rentals</span><Badge variant={latest?.serviceAccessReady ? "success" : "warning"}>{latest?.serviceAccessReady ? "Allowed" : "Verification required"}</Badge></div>
          </div>
        </section>
      </div>

      {message && <div className={styles.message} role="status">{message}</div>}
      {!protectedServiceRequired && <p className={styles.completionHint}>Phone and identity verification may be completed later. NOLI will require them before a protected service is granted.</p>}
      {protectedServiceRequired && !serviceReady && latest && <p className={styles.completionHint}>This service stays blocked until all required verification checks above are complete.</p>}
      <Button size="lg" className={styles.finish} disabled={!canFinish} onClick={() => navigate(resumePath)}>{finishLabel} <ChevronRight size={19}/></Button>
    </main>
  );
}
