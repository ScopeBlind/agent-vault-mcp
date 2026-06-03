## Summary

GBrain already does the important brain work: ingest, retrieval, graph traversal, synthesis, citations, and gap analysis. One small adjacent primitive may be useful for company-brain and agent-runtime use cases: an optional portable provenance envelope for pages that are exported, imported, or handed to an external agent runtime.

This should not be a signing system in GBrain core. It can be a reserved metadata shape plus fixtures.

## Proposed shape

```yaml
provenance:
  source_id: gmail-primary
  source_kind: email
  source_uri_hash: sha256:...
  capture_event_hash: sha256:...
  content_hash: sha256:...
  captured_at: 2026-06-03T00:00:00Z
  signer: did:key:...        # optional
  signature: ed25519:...     # optional, over canonical provenance object
privacy:
  sensitivity: open | approval | sealed
```

## Why this fits GBrain

- GBrain remains the brain: ingestion, graph, retrieval, synthesis, citations, gap analysis.
- The envelope only answers: where did this page come from, did the content change, and can another agent verify that claim after export/import?
- For company/team brains, admins can disclose or move memory with source commitments instead of raw private notes.
- For external runtimes like Hermes, a caller can request context and keep a receipt of exactly what crossed the boundary.

## Minimal PR scope

1. Document a reserved optional `provenance` frontmatter block for imported/exported pages.
2. Add fixtures for canonical `content_hash` and `capture_event_hash` calculation.
3. Preserve existing source fields through ingest/write paths where relevant.
4. Keep signatures optional, external, and verifier-agnostic.

I have a small optional MCP adapter that demonstrates this outside GBrain core: https://github.com/ScopeBlind/agent-vault-mcp, and a draft Hermes catalog PR that uses it as a runtime boundary: https://github.com/NousResearch/hermes-agent/pull/37978.

The goal is to make GBrain memory portable and independently checkable without turning GBrain into a compliance product.
