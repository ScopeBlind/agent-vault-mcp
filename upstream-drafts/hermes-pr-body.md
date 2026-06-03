## Summary

Adds an optional integration guide for using ScopeBlind Agent Vault as a verifiable context/memory layer with Hermes.

Hermes remains the agent runtime. ScopeBlind Agent Vault only adds:

- signed context capsules before a run;
- explicit redactions for sealed/private pages;
- owner-approved memory proposals after a run;
- offline verification of what was disclosed.

This is useful for users running Hermes across machines/models who want portable memory with a verifiable state trail.

## Why this fits Hermes

Hermes already handles execution, models, tools, skills, gateways, and long-running autonomy. Agent Vault is intentionally not another runtime. It is a trust layer around runtime-visible context.

Short version:

> Hermes runs the agent. GBrain remembers. Agent Vault proves what changed, what was disclosed, and what can be trusted.

## Example flow

1. Hermes starts a task.
2. Hermes calls `vault_context_request` over MCP.
3. Agent Vault returns a signed Context Capsule containing only policy-disclosed pages.
4. Hermes uses the included pages as context.
5. Hermes calls `vault_memory_propose` with candidate durable learnings.
6. The user approves/rejects; Hermes cannot silently mutate canonical memory.
7. Anyone can call `vault_capsule_verify` offline.

## Scope

This PR only adds optional docs/example config. It does not add ScopeBlind as a Hermes dependency, does not change Hermes memory behavior, and does not require a hosted ScopeBlind account.
