# Install Agent Vault MCP for an agent runtime

Use this when an agent runtime already has memory/execution but needs verifiable context capsules and owner-approved memory proposals.

## Configure MCP

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

For local development before npm publishing:

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

## Agent protocol

Before a run:

1. Call `vault_context_request` with the page kinds you need.
2. Use only `included_pages` as model-visible context.
3. Treat `redactions` as policy constraints, not as missing data.

After a run:

1. Call `vault_memory_propose` with candidate durable learnings.
2. Do not claim the memory was saved until the owner approves and signs it.
3. If asked to prove what context was disclosed, call `vault_capsule_verify`.

## One-sentence boundary

You may propose memory; you may not silently rewrite the user's Vault.
