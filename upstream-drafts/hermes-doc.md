# ScopeBlind Agent Vault MCP

ScopeBlind Agent Vault can be used as an optional MCP server when you want Hermes to consume verifiable context capsules rather than raw private memory.

Hermes remains the agent runtime. Agent Vault only signs and verifies the context boundary.

## Install

Before npm publication:

```json
{
  "mcpServers": {
    "scopeblind-agent-vault": {
      "command": "node",
      "args": ["/path/to/scopeblind-agent-vault-mcp/src/index.mjs"],
      "env": {
        "SCOPEBLIND_AGENT_MANIFEST": "/path/to/agent/manifest.json",
        "SCOPEBLIND_AGENT_PAGES": "/path/to/agent/signed-pages.json"
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
        "SCOPEBLIND_AGENT_PAGES": "/path/to/agent/signed-pages.json"
      }
    }
  }
}
```

## Recommended use

Before a run, call `vault_context_request` and use only `included_pages` as model-visible context.

After a run, call `vault_memory_propose`. Do not treat proposed memory as saved until the Vault owner approves and signs it.

To audit the boundary, call `vault_capsule_verify`.
