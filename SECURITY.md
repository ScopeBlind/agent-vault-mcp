# Security

This package is a local compatibility adapter for signed Agent Vault artifacts. It is not the managed ScopeBlind runtime.

## Safe defaults

- `vault_memory_propose` does not mutate canonical memory.
- `vault_page_sign` requires an explicit owner secret.
- sealed pages are never disclosed.
- token/approval pages are withheld unless auth is accepted.
- capsules and included pages are verified offline.

## Not included

This package deliberately does not include:

- hosted Vault persistence;
- key custody or recovery;
- managed issuer keys;
- production BRASS/VOPRF issuance;
- enterprise admin controls;
- OAuth connector flows;
- ScopeBlind Mandate proof-pack logic.

Those belong in the managed ScopeBlind product boundary.

## Reporting issues

Report security issues privately to tom@scopeblind.com. Please do not open public issues for suspected key handling, disclosure, or verification bugs.
