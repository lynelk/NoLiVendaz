# NOLI Vendaz Production Integration Notes

## CPay service boundary

NOLI consumes CPay rather than individual downstream providers for core platform services:

- **CPay Hosted Vending**: public-token station lookup, vending start and lifecycle status.
- **CPay Payments**: merchant-signed private API v2 operations where required.
- **CPay Communications**: OTP message enqueue/routing; NOLI owns OTP generation, hashing, expiry and verification.
- **CPay Identity**: consented authoritative identity verification through CPay-configured providers.

Private CPay v2 calls use RSA-SHA256 merchant signing. NOLI does not hold SMS-provider or identity-provider credentials.

## Progressive profile and service access

Basic account/profile setup may be completed before phone or identity verification. Verification becomes mandatory when a protected service requires it.

Power-bank rental access requires a verified registered phone and an accepted authoritative identity verification. The vending payment action re-checks the verified phone server-side even if a client attempts to bypass onboarding UI.

Phone linkage for Uganda uses a fixed `+256` UI prefix and stores the normalized E.164 value. Changing a verified phone invalidates verification and is blocked while a rental is open.

Identity selection is generic. NOLI currently presents NIN, Passport, Refugee ID, Alien/foreign-national ID and Driver's Licence. Local format validation only produces a validated state. CPay Identity must return an authoritative verification result before NOLI records `VERIFIED`.

A document type/country is verifiable only when a configured CPay identity connector explicitly supports that combination.

## Privacy boundary

- Never persist raw full identity numbers in NOLI.
- Persist document type, country, keyed fingerprint, masked display fragment, verification state and safe provider/request references only.
- Never log OTPs, raw identification numbers, private signing keys or provider credentials.
- Identity provider calls require current explicit customer consent.
- Authenticated profile/session/rental/support responses remain non-cacheable.
- Terminal rental records retained after account deletion are anonymized for reconciliation.

## Vending invariants

- Paired CPay stations remain provider-authoritative for release and return.
- Never simulate `ACTIVE` or `RETURNED` for a paired station.
- Missing/ambiguous CPay sessions move to reconciliation/review rather than manufacturing physical state.
- One unpaid checkout draft per customer is enforced at database level.
- Return-station intent is audit context, not proof of physical return.
- Pricing for an existing rental comes from its immutable snapshot rather than later station pricing.
- Refund routing follows the verified registered-phone policy and only uses alternate-payer behavior when CPay explicitly supports it.

## Capability-gated payment features

Keep these unavailable until CPay exposes and validates the corresponding vending contract:

- card-funded Visa/Mastercard vending start;
- CPay Credit vending channel;
- separate payer/refund-MSISDN routing;
- bundled/multi-asset rental release.

## Pilot pricing baseline

Local unpaired seed configuration:

- UGX 500 per 30 minutes per power bank
- UGX 20,000 refundable deposit per power bank
- UGX 5,000 daily maximum per power bank
- 10-minute grace period

CPay/OEM live pricing remains authoritative once a station is paired.

## Deployment controls

- `NOLI_MARKET_MODE=true` hides unpaired setup stations from public discovery.
- `NOLI_LEGAL_APPROVED=true` is set only after current legal/compliance review.
- Admin-only `GET /_api/ops/readiness` is the deployment readiness gate.
- Production launch requires at least one end-to-end verified cabinet/payment/release/return/refund cycle.

## Current validation baseline

- Floot typecheck: **clean**
- Standard specs: **14 passed, 0 failed**
- Hook specs: **2 passed, 0 failed**
- Total: **16 passed, 0 failed**
- Consent version: `2026-08-24-v3`

The application remains capability-gated for public launch until the actual production CPay merchant credentials, communications route, identity-provider coverage and at least one real vending cabinet are verified end to end.
