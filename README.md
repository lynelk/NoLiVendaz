# NOLI Vendaz

NOLI Vendaz is the customer-facing vending application for renting and returning power banks through CPay-connected vending stations.

The product is being built and hosted in Floot. This repository is the GitHub engineering mirror used for source control, integration documentation, review, and release tracking.

## Current customer flow

1. Scan a station QR or enter a configured station code.
2. Resolve live station state and pricing through the CPay vending integration.
3. Sign in with Google and complete verified customer onboarding.
4. Pay through a CPay-supported vending payment method.
5. Wait for provider-verified physical release before the rental becomes ACTIVE.
6. Return the power bank at a compatible station.
7. Record the customer’s intended return station separately from OEM/CPay return verification.
8. Settle usage and refund any unused refundable deposit through CPay.

## Safety model

NOLI does not manufacture payment, release, return, or refund states in the browser.

- CPay remains authoritative for payment and vending orchestration state.
- OEM/provider evidence remains authoritative for physical release and return.
- Unknown provider states do not regress a rental to an earlier financial state.
- Hosted vending start is guarded against duplicate concurrent requests.
- One unpaid checkout draft per customer is enforced at the database layer.
- A timed-out or incomplete CPay start is treated as uncertain rather than automatically retried.
- Customer return intent is stored as evidence but never treated as proof of physical return.
- Sensitive authenticated responses are explicitly non-cacheable.
- Plaintext NIN storage has been removed. NOLI stores a keyed fingerprint plus last four characters only.

## Implemented capabilities

- Google sign-up/sign-in
- Protected customer routes
- SMS OTP phone verification with abuse throttling
- Versioned Terms, Privacy Notice and identity-verification consent
- Registry-gated NIN verification boundary
- QR scanning with iOS/Safari fallback
- Live station readiness checks
- Market-mode discovery that can hide unpaired/setup stations
- CPay capability-aware payment options
- Exactly-once hosted vending start protection
- Registered refund-phone safeguards
- Immutable rental pricing snapshots
- Realtime private rental updates
- Push notifications
- Offline/reconnection recovery
- Unpaid-rental cancellation
- Cross-device active-rental recovery
- Rental history and digital receipts
- Support cases linked to rentals, including damaged-battery safety guidance
- Account management and safe account deletion
- Authentication artifact cleanup
- Customer-safe rendering crash recovery
- Persisted intended return station and return-request timestamp
- Admin-only deployment readiness endpoint

## Kampala pilot pricing baseline

The local launch/demo pricing baseline is:

- **UGX 500 per 30 minutes per power bank**
- **UGX 20,000 refundable deposit per power bank**
- **UGX 5,000 daily maximum per power bank**
- **10-minute grace period before rental charges**

This is not allowed to overwrite a production vendor tariff. Once a station is paired, CPay/OEM live pricing is authoritative and the accepted price is snapshotted onto the rental.

## Market launch gates

A build should not be treated as ready for pilot merely because the UI works. The current deployment gate requires:

- `NOLI_MARKET_MODE=true`
- formally reviewed Customer Terms, Privacy Notice and retention/compliance policy, then `NOLI_LEGAL_APPROVED=true`
- approved Uganda NIN verification provider connected
- at least one live station paired to the CPay hosted vending lifecycle
- production SMS route confirmed
- end-to-end Mobile Money payment, release, return, refund and settlement testing completed
- no orphaned open rental records

The Floot application exposes an admin-only `GET /_api/ops/readiness` status for this purpose.

## External dependencies still required

The application intentionally keeps unsupported financial paths disabled until the upstream contracts exist.

- Approved Uganda NIN verification provider credentials
- CPay public vending token/QR pairing for each production cabinet
- Secure card-funded vending-start contract for Visa/Mastercard
- Confirmed CPay Credit vending channel
- CPay bundled/multi-asset rental semantics if a single request may release multiple power banks
- Separate payer/refund-MSISDN support where alternate mobile-money payer flows are enabled

## Integration boundaries

### NOLI Vendaz

Owns customer experience, authenticated account state, rental presentation, support, consent, local correlation, customer notifications and safety guards.

### CPay

Owns collections, refunds, payment references, financial state, vending orchestration state, provider correlation, ledger and settlement.

### Vending OEM / physical provider

Owns cabinet state, asset availability, ejection, return evidence and physical device events.

## Development status

Current Floot market-hardening baseline:

- TypeScript typecheck: clean
- Active specs: **11 passed, 0 failed**
- Open rentals after prototype cleanup: **0**
- Orphaned open rentals: **0**
- Race-safe unpaid-draft uniqueness guard: enabled
- Latest Floot checkpoint: **Hardened NOLI for market pilot**

GitHub synchronization is being established on the `floot-sync-20260819` branch before review into `main`. The repository is still an engineering mirror in progress and does not yet contain the complete Floot source snapshot.

See `docs/market-readiness.md` and `docs/production-integration.md` for launch controls and integration constraints.

## Repository policy

Do not commit credentials, API keys, NIN values, OAuth secrets, CPay signatures, provider passwords or customer-identifying production data. Environment-specific secrets remain in the deployment/runtime secret store.
