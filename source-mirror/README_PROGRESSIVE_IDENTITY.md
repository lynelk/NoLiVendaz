# Progressive identity source set

The files under `source-mirror/` are copied from Floot project version `1787588282045`, checkpoint `e732cd45-9bf8-4c98-8fc8-0db7d3fe4de2`.

The mirror includes the progressive identity types, privacy-preserving fingerprinting, consent version, protected-service policy, customer-safe profile view, profile persistence API, identity verification API, React Query integration, and tests. The runnable Floot application additionally contains the complete vending, authentication, UI, database, and generated schema dependencies referenced by these files.

Verification remains fail-closed: local format checks do not authorize protected services, and only an authoritative CPay Identity result can produce `VERIFIED`.
