This issue feels like the right substrate for a very small next step: keep GBrain's existing `source_id` / `source_kind` / `source_uri` provenance intact first, then make that provenance optionally portable/verifiable without changing GBrain's retrieval model.

I would *not* suggest putting a signing system in GBrain core. A minimal shape could just be an optional page-level provenance envelope that survives export/import and agent handoff:

```yaml
provenance:
  source_id: gmail-primary
  source_kind: email
  source_uri_hash: sha256:...
  capture_event_hash: sha256:...
  content_hash: sha256:...
  captured_at: 2026-06-03T00:00:00Z
  signer: did:key:...        # optional
  signature: ed25519:...     # optional, over the canonical provenance object
privacy:
  sensitivity: open | approval | sealed
```

Why I think this composes with GBrain rather than competes with it:

- GBrain remains the brain: ingest, graph, retrieval, synthesis, citations, gap analysis.
- The provenance envelope only answers: where did this page come from, did the content change, and can another agent verify that claim after export/import?
- For company-brain / team-brain use, this gives admins a way to move or disclose memory with a source commitment instead of raw private notes.
- For agent runtimes like Hermes, it gives a clean boundary: ask GBrain for context, disclose only approved pages, and keep a receipt of exactly what crossed the boundary.

I put together a small optional MCP adapter that demonstrates the pattern outside GBrain core: https://github.com/ScopeBlind/agent-vault-mcp. I also opened a draft Hermes catalog PR so the integration can be reviewed as an optional runtime boundary rather than a GBrain dependency: https://github.com/NousResearch/hermes-agent/pull/37978.

If useful, I can make this concrete as a tiny GBrain PR with no ScopeBlind dependency:

1. preserve the `IngestionEvent` provenance fields through `ingest_capture` as this issue already describes;
2. document a reserved optional `provenance` frontmatter block for imported/exported pages;
3. add a fixture showing canonical `content_hash` / `capture_event_hash` calculation;
4. leave signing entirely optional, external, and verifier-agnostic.

The goal would be to make GBrain memory portable and independently checkable without turning GBrain into a compliance product.
