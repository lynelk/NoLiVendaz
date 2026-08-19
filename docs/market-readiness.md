# NOLI Vendaz Market Readiness

## Status

The application has completed a market-hardening pass and is technically suitable for a controlled pilot once the external launch gates below are satisfied. It should not yet be described as production-ready for the general public while any mandatory blocker remains unresolved.

## Pilot pricing

Recommended Kampala pilot baseline for locally configured, unpaired seed stations:

- **UGX 500 per 30 minutes per power bank**
- **UGX 20,000 refundable deposit per power bank**
- **UGX 5,000 daily maximum per power bank**
- **10-minute grace period before rental charges begin**

A CPay/OEM-paired station remains authoritative for its live tariff. NOLI snapshots the terms accepted when a rental is created so an existing rental cannot be repriced by a later station update.

## Mandatory launch gates

1. Enable `NOLI_MARKET_MODE=true` so unpaired setup/demo stations disappear from public discovery.
2. Record `NOLI_LEGAL_APPROVED=true` only after the current Customer Terms, Privacy Notice, formal data-retention policy and applicable launch compliance have been reviewed.
3. Connect the approved Uganda NIN-verification provider using secure runtime credentials.
4. Pair at least one production cabinet to the CPay hosted vending lifecycle and validate its QR/public token.
5. Confirm the production Africa's Talking SMS sender and route.
6. Run real end-to-end Mobile Money scenarios: success, decline, timeout, late success, ambiguous vending start, verified release, failed release, return, refund and settlement.
7. Verify support escalation and operational ownership for paid/no-release, unconfirmed return, delayed refund and damaged battery incidents.
8. Confirm there are no orphaned open rentals before launch.

## Financial and vending invariants

- No authoritative CPay payment means no physical release.
- A UI success state never substitutes for provider evidence.
- Ambiguous CPay/OEM results move to reconciliation/review rather than blind retry.
- Exactly one unpaid draft can exist per customer at a time, protected by a database uniqueness guard.
- Customer-selected return location is recorded as intent, not proof of physical return.
- Refund routing follows the verified registered phone policy and only uses alternate-payer behavior when CPay exposes the required capability.
- Visa/Mastercard vending remains disabled until CPay supports a safe pre-funded/card-funded vending-start contract.
- CPay Credit remains disabled until a supported vending credit channel is configured.
- Multiple simultaneous power-bank release remains capability-gated until CPay supports bundled/multi-asset vending semantics.

## Identity and privacy controls

- Google is the current public account sign-in route.
- Phone OTP is rate-limited and short-lived.
- Full NIN is not stored. NOLI retains a keyed fingerprint, masked suffix and verification state.
- Registry verification requires explicit current consent.
- Sensitive authenticated APIs return `no-store` cache controls.
- Account deletion is blocked while a financial or physical rental remains open.
- Settled rental records retained after account deletion are anonymized for reconciliation.

## Customer safety

Damaged-power-bank support explicitly tells customers to stop use for unusually hot, swollen, leaking, smoking or physically damaged equipment, disconnect it, keep it away from flammable material, notify venue staff and not attempt repair.

## Operational readiness endpoint

Floot exposes an admin-only:

`GET /_api/ops/readiness`

The response reports launch blockers without returning credentials, including integration configuration, paired station count, payment capability coverage, open rentals, orphaned rentals, market mode and legal-approval state.

Do not proceed to external pilot while it reports `BLOCKED`.

## Current validation baseline

- TypeScript: clean
- Active specs: **11 passed, 0 failed**
- Open rentals after prototype cleanup: **0**
- Orphaned open rentals: **0**
- Duplicate unpaid-draft database protection: enabled
- Current Terms / Privacy consent version: `2026-08-20-v2`
- Latest Floot checkpoint: `Hardened NOLI for market pilot`

## Repository status

The GitHub repository is currently an engineering mirror in progress. Documentation is synchronized, but the complete Floot application source has not yet been mirrored into GitHub. Keep the current PR in draft until the source snapshot and release process are complete.
