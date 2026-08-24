# Vending integration note

The live Floot rental creation and rental-action endpoints enforce the progressive verification policy before any protected rental/payment operation. The authoritative runtime remains Floot checkpoint `e732cd45-9bf8-4c98-8fc8-0db7d3fe4de2`.

Key invariant: no authoritative payment success means no physical release request. Identity and phone checks are completed before the customer can create the protected rental flow.
