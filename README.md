# ScopeBlind Agent Vault MCP

MCP adapter for portable, verifiable agent memory.

The adapter is not another agent runtime and not another memory database. Hermes can run the agent. GBrain can remember and synthesize. Agent Vault proves what context was disclosed, what memory was proposed, and what state changed.

> Hermes runs the agent. GBrain remembers. Agent Vault proves what changed, what was disclosed, and what can be trusted.

## What it exposes

- `vault_manifest_get` — read stable agent identity and live state hashes.
- `vault_pages_list` — list signed pages with sensitivity labels.
- `vault_disclosure_policy_check` — see which pages would be disclosed or withheld.
- `vault_context_request` — issue a signed context capsule for model/runtime use.
- `vault_capsule_export` — alias for context capsule export.
- `vault_capsule_verify` — verify capsule and included page signatures offline.
- `vault_memory_propose` — create a signed memory proposal without mutating the Vault.
- `vault_page_sign` — owner-only canonical page signing when an agent secret is explicitly supplied.

## Why this matters

Normal memory systems optimize retrieval. Agent Vault optimizes trust:

- signed pages are source-of-truth;
- redactions are explicit;
- sealed content remains committed but hidden;
- external agents can propose memory but cannot silently poison memory;
- capsules are independently verifiable offline.

## Quick start

Before npm publication, run from this repository:

```bash
npm test
npm run self-test
```

After npm publication:

```bash
npx -y @scopeblind/agent-vault-mcp
```

The bundled example reads:

- `examples/agent-vault/manifest.json`
- `examples/agent-vault/signed-pages.json`

## Configure a runtime

Before npm publication:

```json
{
  "mcpServers": {
    "scopeblind-agent-vault": {
      "command": "node",
      "args": ["/path/to/scopeblind-agent-vault-mcp/src/index.mjs"],
      "env": {
        "SCOPEBLIND_AGENT_MANIFEST": "/path/to/agent/manifest.json",
        "SCOPEBLIND_AGENT_PAGES": "/path/to/agent/signed-pages.json",
        "SCOPEBLIND_AGENT_VAULT_ALLOW_DEMO_AUTH": "false"
      }
    }
  }
}
```

After npm publication:

```json
{
  "mcpServers": {
    "scopeblind-agent-vault": {
      "command": "npx",
      "args": ["-y", "@scopeblind/agent-vault-mcp"],
      "env": {
        "SCOPEBLIND_AGENT_MANIFEST": "/path/to/agent/manifest.json",
        "SCOPEBLIND_AGENT_PAGES": "/path/to/agent/signed-pages.json",
        "SCOPEBLIND_AGENT_VAULT_ALLOW_DEMO_AUTH": "false"
      }
    }
  }
}
```

## Recommended Hermes/GBrain loop

1. Hermes asks GBrain for relevant project memory.
2. Hermes calls `vault_context_request` to obtain a signed, policy-filtered context capsule.
3. Hermes works with only disclosed context.
4. Hermes calls `vault_memory_propose` with candidate learnings.
5. The user approves or rejects the proposal in ScopeBlind.
6. The Vault owner signs the canonical page.
7. The State Sigil changes.
8. Anyone can call `vault_capsule_verify` to prove the disclosure path.

## Security boundary

`vault_memory_propose` is deliberately not `vault_memory_write`.

External runtimes can suggest memory. They cannot mutate durable memory unless the Vault owner signs the page. This is the anti-poisoning boundary.

For sensitive context, this local adapter accepts BRASS-shaped proofs only when they are already marked verified, or a demo stub only when `SCOPEBLIND_AGENT_VAULT_ALLOW_DEMO_AUTH=true`. Full DLEQ/VOPRF verification remains the managed ScopeBlind runtime boundary.

## Commercial boundary

This package is the open compatibility layer. It deliberately does not include hosted Vault persistence, key custody/recovery, managed BRASS issuance, OAuth connectors, enterprise audit rooms, or Mandate proof-pack logic.
