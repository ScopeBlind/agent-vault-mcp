This issue feels like the right substrate for a small, GBrain-native provenance layer.

First priority is exactly what this issue says: preserve `source_id`, `source_kind`, and `source_uri` through `ingest_capture` so the accepted `IngestionEvent` contract survives the actual page write.

A useful follow-on might be an optional page-level provenance envelope that can survive export/import and agent handoff without changing GBrain's retrieval model or adding a signing system to core:

```yaml
provenance:
  source_id: gmail-primary
  source_kind: email
  source_uri_hash: sha256:...
  capture_event_hash: sha256:...
  content_hash: sha256:...
  captured_at: 2026-06-03T00:00:00Z
  signer: did:key:...        # optional, external
  signature: ed25519:...     # optional, over the canonical provenance object
privacy:
  sensitivity: open | approval | sealed
```

Why I think this composes with GBrain rather than competes with it:

- GBrain remains the brain: ingest, graph, retrieval, synthesis, citations, gap analysis.
- The envelope only answers: where did this page come from, did the content change, and can another agent verify that claim after export/import?
- For company-brain/team-brain use, it gives admins a way to move or disclose memory with source commitments instead of raw private notes.
- For runtimes like Hermes, it gives a clean boundary: request context from GBrain, disclose only approved pages, and keep a receipt of exactly what crossed the boundary.

I put together a small optional MCP adapter that demonstrates this outside GBrain core: https://github.com/ScopeBlind/agent-vault-mcp. I also opened a draft Hermes catalog PR so the pattern can be reviewed as an optional runtime boundary rather than a GBrain dependency: https://github.com/NousResearch/hermes-agent/pull/37978.

If useful, I can make the GBrain side concrete as a tiny PR with no ScopeBlind dependency:

1. add a regression test for preserving `IngestionEvent` provenance through `ingest_capture`;
2. document a reserved optional `provenance` frontmatter block for imported/exported pages;
3. add a fixture for canonical `content_hash` / `capture_event_hash` calculation;
4. leave signatures entirely optional, external, and verifier-agnostic.

The goal is narrow: make GBrain memory portable and independently checkable without turning GBrain into a compliance product.
