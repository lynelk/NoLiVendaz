# NOLI Vendaz Floot Source Mirror

This directory mirrors the tested source of the NOLI Vendaz Floot application so the progressive identity-verification implementation is reviewable and versioned in GitHub.

- Floot project: `4a50fb0d-fe27-4e1a-bdf8-2413a3b5cd8a`
- Floot version: `1787588282045`
- Checkpoint: `e732cd45-9bf8-4c98-8fc8-0db7d3fe4de2` (`Added progressive identity verification`)

The mirror preserves the Floot virtual paths below this directory. Floot remains the runnable/hosted application source of truth; this GitHub mirror is the committed engineering record.

## Progressive identity guarantees

- Account setup is distinct from protected-service eligibility.
- Phone and authoritative identity verification are required before a power-bank rental.
- Local document format checks never create `VERIFIED` status.
- Full identity numbers are not stored in customer-facing profile data; keyed fingerprints and masked fragments are used.
- CPay Identity is the server-side verification boundary and provider router.
- Existing NIN response aliases remain available for backward compatibility.
- No physical vending release is requested without authoritative payment success.
