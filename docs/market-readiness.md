# NOLI Vendaz Market Readiness

## Status

The application has completed a market-hardening and progressive-identity pass. It is suitable for a controlled pilot only after the remaining external launch gates are satisfied.

## Pilot pricing

Local unpaired seed baseline:

- **UGX 500 per 30 minutes per power bank**
- **UGX 20,000 refundable deposit per power bank**
- **UGX 5,000 daily maximum per power bank**
- **10-minute grace period**

Paired CPay/OEM pricing remains authoritative and is snapshotted onto the rental when accepted.

## Mandatory launch gates

1. Enable `NOLI_MARKET_MODE=true` so unpaired setup/demo stations are hidden from public discovery.
2. Set `NOLI_LEGAL_APPROVED=true` only after the current Terms, Privacy Notice, retention schedule and applicable launch compliance are formally reviewed.
3. Configure NOLI's merchant-signed CPay v2 service identity (`CPAY_API_BASE_URL`, merchant number and signing key) in the runtime secret store.
4. Ensure CPay Communications has a production SMS route for NOLI OTP messages.
5. Ensure CPay Identity has at least one approved production identity provider and explicitly configured type/country coverage. NOLI must never interpret local format validation as verification.
6. Pair at least one production cabinet to CPay hosted vending and validate its QR/public token.
7. Run real Mobile Money scenarios: success, decline, timeout, late success, ambiguous start, verified release, failed release, return, refund and settlement.
8. Verify support ownership for paid/no-release, unconfirmed return, delayed refund and damaged-battery incidents.
9. Confirm there are no orphaned open rentals before launch.

## Progressive verification gates

Early account setup may be completed without phone or identity verification. Protected services enforce their own policy at access time.

For a power-bank rental, NOLI requires:

- authenticated customer;
- verified registered phone;
- an accepted identity type with authoritative `VERIFIED` state;
- current required consent/terms state.

The original rental context is preserved while the customer completes missing verification.

## Identity and privacy controls

- Uganda phone UX uses a fixed `+256` prefix and stores normalized E.164 values.
- OTPs are generated/verified by NOLI and transported by CPay Communications.
- Generic document types are validated locally by type/country-specific rules.
- Authoritative verification is performed through CPay Identity and its configured provider.
- Raw identity numbers are not persisted by NOLI.
- Sensitive authenticated APIs use `no-store` cache controls.
- Account deletion is blocked while a financial or physical rental is open; retained terminal transaction records are anonymized for reconciliation.

## Financial and vending invariants

- No authoritative CPay payment means no physical release.
- UI state never substitutes for provider evidence.
- Ambiguous CPay/OEM results move to reconciliation/review rather than blind retry.
- Exactly one unpaid draft per customer is protected by a database uniqueness guard.
- Customer-selected return location is intent, not physical proof.
- Unsupported Visa/Mastercard vending, CPay Credit, alternate-payer refunds and multi-asset release remain capability-gated.

## Operational readiness endpoint

Admin-only:

`GET /_api/ops/readiness`

It reports deployment blockers without returning credentials. External pilot should not proceed while it reports `BLOCKED`.

## Current validation baseline

- TypeScript: **clean**
- Standard specs: **14 passed, 0 failed**
- Hook specs: **2 passed, 0 failed**
- Total: **16 passed, 0 failed**
- Current Terms / Privacy / identity consent version: `2026-08-24-v3`

## Repository status

This repository is the engineering/integration mirror for the Floot-hosted application. Integration contracts, release controls and product-specific architecture are maintained here; runtime credentials and production customer data are not.
