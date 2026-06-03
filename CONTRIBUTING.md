# Contributing

The adapter should stay small and runtime-agnostic.

Good contributions:

- MCP compatibility improvements;
- clearer Hermes/GBrain/Claude/Codex examples;
- offline verification fixes;
- signed-page or context-capsule test vectors;
- docs that clarify disclosure and memory-proposal boundaries.

Avoid contributions that turn this into:

- a full memory database;
- an agent runtime;
- a hosted SaaS backend;
- a production key-custody service;
- a replacement for managed BRASS/VOPRF issuance.

The design goal is composability: runtimes run, memory systems retrieve, Agent Vault verifies.
