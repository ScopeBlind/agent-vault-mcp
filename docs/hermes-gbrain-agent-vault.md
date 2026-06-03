# Hermes + GBrain + Agent Vault

ScopeBlind Agent Vault should compose with Hermes and GBrain rather than compete with them.

## Roles

| Layer | Job | ScopeBlind stance |
| --- | --- | --- |
| Hermes | Runs autonomous work loops, tools, and skills | Use it as an execution runtime |
| GBrain | Stores/synthesizes research memory | Use it as a memory/retrieval substrate |
| Agent Vault | Signs state, discloses context selectively, verifies memory changes | Keep this as the trust layer |

Short version: Hermes runs the agent. GBrain remembers. Agent Vault proves what changed, what was disclosed, and what can be trusted.

## Product pattern

A runtime should not receive the whole Vault. It should request a capsule:

1. Runtime calls `vault_context_request` with requested page kinds and requester metadata.
2. Agent Vault returns a signed Context Capsule.
3. The capsule contains disclosed pages, explicit redactions, committed hidden fields, auth result, expiry, and a signature.
4. Runtime uses the capsule as context.
5. Runtime calls `vault_memory_propose` with candidate updates.
6. Owner approval signs the canonical page and advances the State Sigil.

This is the difference between portable memory and trusted portable memory.

## MCP tools

The package `@scopeblind/agent-vault-mcp` exposes:

- `vault_manifest_get`
- `vault_pages_list`
- `vault_disclosure_policy_check`
- `vault_context_request`
- `vault_capsule_export`
- `vault_capsule_verify`
- `vault_memory_propose`
- `vault_page_sign`

## Contribution targets

After dogfooding the adapter locally, useful upstream contributions would be:

### Hermes

- Example: `examples/scopeblind-agent-vault-memory` showing a signed context capsule before an autonomous run.
- Hook: emit a receipt after each skill/cron/tool run.
- Skill: `/request-vault-context` that calls the MCP adapter and injects only the returned capsule.
- Skill: `/propose-vault-memory` that records learnings without mutating durable memory.

### GBrain

- Signed-page import/export metadata in markdown frontmatter.
- Optional `page_hash`, `prev_hash`, `signature`, `sensitivity`, `source_model`, `source_session` fields.
- Provenance-preserving export: GBrain memory bundle -> Agent Vault signed pages.
- Verification docs explaining that Agent Vault signs memory state while GBrain handles retrieval/synthesis.

## Guardrail

Do not let a runtime write canonical memory directly. It should propose memory and let the Vault owner approve.

That is the boundary that prevents prompt-injection memory poisoning across models and platforms.
