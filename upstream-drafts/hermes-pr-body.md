## Summary

Adds ScopeBlind Agent Vault as an optional Hermes MCP catalog entry.

This lets Hermes request signed Agent Vault context capsules before a run, propose owner-reviewed memory updates after a run, and verify the disclosed context boundary offline.

Hermes remains the agent runtime. ScopeBlind Agent Vault only adds:

- signed context capsules before a run;
- explicit redactions for sealed/private pages;
- owner-reviewed memory proposals after a run;
- offline verification of what context was disclosed.

## Why this fits Hermes

Hermes already handles execution, model/provider routing, tools, skills, gateways, and long-running autonomy. Agent Vault is intentionally not another runtime. It is a trust layer around runtime-visible context.

Short version:

> Hermes runs the agent. GBrain remembers. Agent Vault proves what changed, what was disclosed, and what can be trusted.

## Install behavior

The catalog entry is a git-installed local stdio MCP pinned to the current ScopeBlind adapter commit:

- source: https://github.com/ScopeBlind/agent-vault-mcp
- ref: `c9ae9662aec1abcc3e98fa45a3230b486c6f3261`
- bootstrap: `npm install --omit=dev`

It ships with a demo Vault so it can run immediately. Users can point it at their own Vault by setting:

```bash
SCOPEBLIND_AGENT_MANIFEST=/path/to/agent/manifest.json
SCOPEBLIND_AGENT_PAGES=/path/to/agent/signed-pages.json
```

## Safety defaults

The default enabled tools are read/propose/verify tools:

- `vault_manifest_get`
- `vault_pages_list`
- `vault_disclosure_policy_check`
- `vault_context_request`
- `vault_capsule_export`
- `vault_capsule_verify`
- `vault_memory_propose`

`vault_page_sign` is intentionally not enabled by default because it requires an explicit owner signing secret and should only be used for owner-approved canonical writes.

## Scope

This PR only adds an optional MCP catalog manifest. It does not add ScopeBlind as a Hermes dependency, does not change Hermes memory behavior, and does not require a hosted ScopeBlind account.
