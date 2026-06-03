# Agent runtime instructions

Use these instructions in Hermes, Claude, Codex, or another MCP-capable agent after connecting `scopeblind-agent-vault`.

## Before using user memory

Call `vault_context_request` with the page kinds you need. Use only `included_pages` as context. Treat `redactions` as constraints.

## After learning something durable

Call `vault_memory_propose`. Do not claim the memory has been saved. The Vault owner must approve/sign the page before it becomes durable memory.

## Before sharing proof

Call `vault_capsule_verify` on the capsule and report:

- whether the capsule signature verifies;
- which pages were included;
- which fields were committed but hidden;
- why sensitive pages were withheld.

## Do not

- ask for sealed page content;
- write canonical memory directly;
- bypass the disclosure result;
- treat a memory proposal as an approved page.
