# Progressive Phone and Identity Verification

## Objective

NOLI uses progressive verification: customers may create and configure an account without completing every identity check immediately, but a protected service must enforce its required assurance level before access.

## Phone linkage

For the Uganda market, the UI shows a fixed `+256` prefix and the customer enters the remaining national mobile digits. Local/server validation runs before an OTP can be requested.

OTP flow:

1. Validate and normalize the phone to E.164.
2. Create a short-lived OTP and persist only its secure hash.
3. Enqueue the OTP through CPay Communications with an idempotent NOLI reference.
4. Apply resend, attempt and hourly abuse limits.
5. Verify the submitted OTP against the authenticated customer and pending phone.
6. Record the verified phone and timestamp; immediately invalidate the OTP.

Phone verification is optional during early setup. If the customer requests a service requiring a verified phone, access is blocked until this flow succeeds. Changing a verified phone invalidates the prior verification.

## Identity selection and validation

Identity input is `ID type + country + ID number`, not a NIN-only field. Supported selections are policy/configuration driven. Current customer selections include:

- National Identification Number (NIN)
- Passport
- Refugee ID
- Alien / foreign-national ID
- Driver's Licence

Each type has its own format/length/character validation. Validation is structural only and never sets `VERIFIED`.

## Authoritative verification

After validation and explicit current consent, NOLI sends the normalized document to CPay Identity using the merchant-signed API v2 service identity.

`NOLI -> CPay Identity -> configured identity connector -> authoritative/approved source`

A provider must explicitly support the requested type/country. Unsupported combinations remain unverified and cannot be promoted merely because local validation passed.

Customer-facing lifecycle:

- `NOT_SUBMITTED`
- `FORMAT_INVALID`
- `FORMAT_VALID`
- `VERIFICATION_PENDING`
- `VERIFIED`
- `VERIFICATION_FAILED`
- `REVIEW_REQUIRED`

Only explicit authoritative `VERIFIED` is sufficient for a protected service that requires identity assurance.

## Service-access policy

Phone and identity checks are not scattered page-specific conditions. NOLI evaluates a reusable service policy when the customer attempts an operation.

For power-bank rental the current policy requires:

- authenticated customer;
- verified registered phone;
- verified accepted identity;
- current required consent/terms state.

If a requirement is missing, NOLI sends the customer to the relevant verification step while preserving the original station, quantity and intended action. On success the original service can resume.

## Privacy and security

- Raw full identity numbers are not persisted in NOLI.
- NOLI stores a keyed fingerprint, masked suffix, type/country, status and safe request/provider references.
- OTPs are never stored or logged in plaintext.
- CPay owns downstream communications and identity-provider credentials.
- NOLI uses merchant-scoped RSA authentication, never CPay administrator credentials.
- Sensitive authenticated API responses are non-cacheable.
- Validation failure, provider outage or ambiguous provider status always fails closed for service access.

## Backward compatibility

Legacy NIN fields and endpoints remain as compatibility aliases while the generic identity model is adopted. Existing verified NIN customers are migrated forward as `NIN/UG`; they are not forced to repeat a valid verification solely because the storage model changed.

## Current validation

- 14 standard Floot spec files passed.
- 2 hook spec files passed.
- TypeScript typecheck is clean.
- Current consent version: `2026-08-24-v3`.
