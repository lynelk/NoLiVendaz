# NOLI Vendaz

NOLI Vendaz is the customer-facing vending application for renting and returning power banks through CPay-connected vending stations. The live application is built and hosted in Floot; this repository is the engineering, integration and release mirror.

## Customer journey

1. Browse or scan a CPay-paired station.
2. Sign in with Google.
3. Save basic profile details. Phone and identity verification may be completed now or later.
4. When a protected service such as a rental is requested, NOLI evaluates the service-access policy.
5. Any missing mandatory verification is completed without losing the original station/rental context.
6. Payment is initiated only through a CPay-supported vending rail.
7. CPay/OEM evidence remains authoritative for release, return, settlement and refund.

## Progressive identity model

NOLI deliberately separates **validation** from **verification**:

- Validation checks local structure, length and allowed characters.
- Verification is the authoritative CPay Identity/provider decision.
- A format-valid document is never treated as verified.
- Phone and ID verification are optional during early account setup but mandatory at the service boundary when that service requires them.

Current Uganda phone UX uses a fixed `+256` prefix with the customer entering the remaining national digits. OTP transport is provided through **CPay Communications**.

Supported customer document selections are configuration/policy driven and currently include NIN, Passport, Refugee ID, Alien/foreign-national ID and Driver's Licence. A document can become `VERIFIED` only when CPay has a configured provider that explicitly supports its type and country.

Raw identity numbers are not persisted by NOLI. The application stores a keyed fingerprint, masked display fragment, document type/country, verification state and provider/request references required for audit and recovery.

## Safety model

- No authoritative CPay payment success means no physical release request.
- Unknown or ambiguous provider states never become optimistic success states.
- Hosted vending start is guarded against concurrent duplicate requests.
- One unpaid checkout draft per customer is enforced at database level.
- Customer return intent is evidence only; OEM/CPay physical verification ends the rental.
- A vending payment requires a verified registered phone even though phone linkage is optional during early onboarding.
- Sensitive authenticated responses are explicitly non-cacheable.
- Full card PAN/CVV and full plaintext identity numbers are never stored by NOLI.

## Implemented capabilities

- Google-only public sign-up/sign-in
- Progressive phone linking and OTP verification
- CPay Communications for OTP delivery
- Generic document selection and type-specific validation
- CPay Identity for consented authoritative verification
- Reusable protected-service access policy
- Backward-compatible NIN aliases for older clients
- QR scanning with iOS/Safari fallback
- Live station readiness checks and market-mode filtering
- CPay capability-aware payment options
- Exactly-once hosted vending start protection
- Registered refund-phone safeguards
- Immutable rental pricing snapshots
- Realtime private rental updates and push notifications
- Offline/reconnection recovery and cross-device rental recovery
- Rental history, receipts, support, account deletion and privacy controls
- Provider-authoritative return intent/reconciliation
- Admin-only deployment readiness endpoint

## Kampala pilot pricing baseline

For local unpaired seed configuration:

- **UGX 500 per 30 minutes per power bank**
- **UGX 20,000 refundable deposit per power bank**
- **UGX 5,000 daily maximum per power bank**
- **10-minute grace period before rental charges**

A paired CPay/OEM station remains authoritative for live pricing. Accepted terms are snapshotted onto each rental.

## CPay integration

NOLI consumes CPay as the platform boundary for:

- hosted vending and vending lifecycle;
- merchant-signed private API v2 operations;
- Identity verification;
- Communications/OTP transport;
- payment, refund and settlement references.

Private API v2 uses RSA-SHA256 merchant signing. Provider credentials remain inside CPay rather than NOLI.

## Capability gates

The UI does not advertise unsupported financial behavior as live. Visa/Mastercard vending, CPay Credit, alternate-payer/refund routing and bundled multi-power-bank release remain disabled until CPay exposes and validates the corresponding vending contracts.

## Validation baseline

Current Floot progressive-identity baseline:

- TypeScript typecheck: **clean**
- Standard specs: **14 passed, 0 failed**
- Hook specs: **2 passed, 0 failed**
- Total: **16 passed, 0 failed**
- Customer Terms / Privacy / identity consent version: `2026-08-24-v3`

See `docs/progressive-identity-verification.md`, `docs/production-integration.md` and `docs/market-readiness.md`.

## Repository policy

Do not commit credentials, signing keys, OAuth secrets, OTP values, raw identity numbers, provider passwords, CPay signatures or customer production data. Runtime secrets belong in the deployment secret store.
