# NOLI Vendaz Floot Source Mirror

This directory mirrors the tested customer-facing source of the NOLI Vendaz Floot application so the progressive phone and identity-verification implementation is reviewable and versioned in GitHub.

- Floot project: `4a50fb0d-fe27-4e1a-bdf8-2413a3b5cd8a`
- Floot version: `1787588282045`
- Checkpoint: `e732cd45-9bf8-4c98-8fc8-0db7d3fe4de2` (`Added progressive identity verification`)
- Standard Floot specs: **14 passed, 0 failed** at the mirrored version

Floot remains the runnable and hosted application source of truth. This GitHub directory is the committed engineering record of the customer implementation and deliberately excludes generated design-system boilerplate, deployment secrets and production customer data.

## Mirrored customer scope

The source mirror now covers the progressive customer journey end to end rather than only the identity helper layer:

- generic identity document definitions, validation and tests
- privacy-preserving identity fingerprinting and customer profile projection
- CPay Identity client and verification boundary
- profile GET/POST contracts and persistence logic
- generic and legacy-NIN verification endpoints
- phone linking and OTP safeguards
- protected-service eligibility policy and tests
- rental creation gate enforcing authoritative profile readiness before payment
- progressive onboarding and resume flow
- customer Account verification/readiness state
- current Privacy Notice and Customer Terms
- privacy-safe account deletion

## Progressive identity guarantees

- Account/profile setup is distinct from protected-service eligibility.
- Phone linkage and identity verification may be deferred during basic setup.
- A power-bank rental requires the current service-access policy to be satisfied before checkout can proceed.
- Local document format checks never create `VERIFIED` status.
- Full identity numbers are not returned in customer-facing profile data and are not retained as plaintext; server-keyed fingerprints and masked fragments are used.
- CPay Identity is the server-side authoritative verification boundary and provider router.
- Existing NIN request/response aliases remain available for backward compatibility.
- Changing a registered phone or identity while a rental is open is blocked.
- Account deletion removes generic identity state and customer contact data once all rentals are terminal.
- No physical vending release is requested without authoritative payment success.

## Supported customer identity types

The current NOLI UI understands `NIN`, `PASSPORT`, `REFUGEE_ID`, `ALIEN_ID`, and `DRIVER_LICENCE`. Displaying a document type does not imply that the configured CPay identity provider can verify it. Provider capability is authoritative, and unsupported type/country combinations must fail closed rather than be promoted to verified state.
