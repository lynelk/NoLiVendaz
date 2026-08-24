# NOLI Vendaz Production Integration Notes

## External connections

- Africa's Talking credentials are connected in Floot; OTP endpoints are bound to the saved account phone and rate-limited.
- The approved Uganda/NIN identity-verification provider still needs to complete the credential connection. NOLI must never mark a NIN `VERIFIED` from format validation alone.
- CPay base API credentials are connected, but each live vending station still requires a CPay public vending token / QR pairing before NOLI will accept payment.

## CPay vending capabilities still required for full payment coverage

- Add a secure card-funded vending-start contract so a successful hosted Visa/Mastercard payment can fund a vending rental without a second deposit collection.
- Enable or confirm a CPay Credit vending channel and expose its channel code to NOLI.
- Add bundled / multi-asset rental semantics to CPay if locations are to release more than one power bank in a single customer request.
- Confirm separate payer/refund-MSISDN support before alternate-payer Mobile Money is enabled.

## App readiness rules

- Paired CPay stations remain provider-authoritative for release and return status.
- Never simulate `ACTIVE` or `RETURNED` for a CPay-paired station.
- Missing CPay vending sessions move to review instead of manufacturing physical state.
- Google Sign Up / Sign In is the supported public authentication path.
- Return Power Bank recovers the authenticated user's in-progress rental even when local browser storage is missing.
- Customer-selected return station and return-request time are audit evidence only. They do not prove physical return.
- One unpaid checkout draft per customer is enforced at database level to prevent concurrent duplicate checkout creation.
- Set `NOLI_MARKET_MODE=true` for pilot/production so setup stations that are not CPay-paired do not appear in public discovery.
- Set `NOLI_LEGAL_APPROVED=true` only after the current Terms, Privacy Notice, data-retention schedule and launch compliance have been formally reviewed.
- The admin-only `GET /_api/ops/readiness` response is the deployment gate. Do not launch while it reports `BLOCKED`.

## Pilot pricing baseline

For unpaired seed/launch configuration the current baseline is:

- UGX 500 per 30 minutes per power bank
- UGX 20,000 refundable deposit per power bank
- UGX 5,000 maximum rental charge per day per power bank
- 10-minute grace period before rental charges

These values are a local launch baseline only. When a CPay/OEM station is paired, its live provider tariff remains authoritative. The tariff accepted for a rental is snapshotted on that rental and must not be rewritten by a later price change.

## Financial safety rules

- Never send a second payment because a frontend request timed out.
- Never retry a hosted vending start if the provider may have processed it but the response was lost.
- Unknown provider statuses must preserve the last trusted customer-facing state or move to review.
- Auto-refund only after definitive, provider-verified release failure and only where no physical release evidence exists.
- Pricing shown for an existing rental comes from that rental's pricing snapshot, not the station's current tariff.
- Refund destinations must follow the verified-account policy and the capabilities explicitly exposed by CPay.

## Identity and privacy rules

- Do not persist full plaintext NIN values.
- Store only a keyed fingerprint for matching/uniqueness plus last-four display data.
- Send the full NIN to the configured registry only during an explicitly consented verification request.
- Authenticated profile, session, rental and support responses must be non-cacheable.
- Account deletion must refuse while a financially or physically open rental exists; settled transaction records may be retained only in anonymized form for reconciliation.

## Current validation baseline

At the time this document was synchronized:

- Floot typecheck: clean
- Active specs: 11 passed, 0 failed
- Open rentals after prototype cleanup: 0
- Orphaned open rentals: 0
- Database unpaid-draft concurrency guard: enabled
- Customer Terms / Privacy consent version: `2026-08-20-v2`

The application remains blocked for external market launch until the approved NIN verifier is connected, at least one real cabinet is CPay-paired, launch mode/legal approval are explicitly enabled, and the real end-to-end payment/release/return/refund flow has passed pilot testing.
