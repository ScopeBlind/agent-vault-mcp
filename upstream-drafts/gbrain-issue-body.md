GBrain already solves the useful memory/retrieval side of agent brains. One adjacent pattern that may be useful is a verifiable export/import layer for memory pages, so external systems can prove what memory existed, where it came from, and whether an agent only saw allowed context.

I have a small MCP adapter for ScopeBlind Agent Vault that treats memory as signed pages and exposes:

- `vault_context_request` — export only policy-disclosed pages as a signed Context Capsule;
- `vault_memory_propose` — let an external agent suggest memory without silently mutating durable memory;
- `vault_capsule_verify` — verify offline what was disclosed and what was withheld.

This is not meant to replace GBrain. GBrain remembers/retrieves/synthesizes. Agent Vault signs/verifies the trust boundary.

Potential GBrain-compatible metadata fields in markdown/frontmatter:

```yaml
page_hash: sha256:...
prev_hash: sha256:...
signature: ed25519:...
sensitivity: open | token | approval | sealed
source_model: hermes-agent | claude | codex | direct-upload
source_session: ...
```

Would a small optional export/import example be useful? I can keep it minimal: no ScopeBlind dependency in GBrain core, just docs or a sample showing how a GBrain memory page could carry verifiable provenance metadata.
