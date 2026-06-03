#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const server = path.resolve(root, "src/index.mjs");
const env = {
  ...process.env,
  SCOPEBLIND_AGENT_MANIFEST: path.join(root, "examples/agent-vault/manifest.json"),
  SCOPEBLIND_AGENT_PAGES: path.join(root, "examples/agent-vault/signed-pages.json"),
  SCOPEBLIND_AGENT_VAULT_MCP_SECRET_HEX: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  SCOPEBLIND_AGENT_VAULT_MCP_KID: "did:key:test#agent-vault-mcp",
};

const child = spawn(process.execPath, [server], { env, stdio: ["pipe", "pipe", "inherit"] });
let buffer = Buffer.alloc(0);
let nextId = 1;
const pending = new Map();

child.stdout.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const header = buffer.subarray(0, headerEnd).toString("utf8");
    const length = Number(/Content-Length:\s*(\d+)/i.exec(header)?.[1] || 0);
    const start = headerEnd + 4;
    if (buffer.length < start + length) return;
    const body = buffer.subarray(start, start + length).toString("utf8");
    buffer = buffer.subarray(start + length);
    const msg = JSON.parse(body);
    const resolve = pending.get(msg.id);
    pending.delete(msg.id);
    resolve(msg);
  }
});

function call(method, params = {}) {
  const id = nextId++;
  const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
  child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  return new Promise((resolve) => pending.set(id, resolve));
}

try {
  const init = await call("initialize", {});
  assert.equal(init.result.serverInfo.name, "scopeblind-agent-vault-mcp");

  const listed = await call("tools/list", {});
  assert.ok(listed.result.tools.some((tool) => tool.name === "vault_context_request"));

  const manifest = await call("tools/call", { name: "vault_manifest_get", arguments: {} });
  assert.equal(manifest.result.structuredContent.agent_id, "agent:tom/research-agent");

  const policy = await call("tools/call", { name: "vault_disclosure_policy_check", arguments: { requested_kinds: ["skill", "memory", "policy"] } });
  assert.equal(policy.result.structuredContent.disclosed, 1);
  assert.equal(policy.result.structuredContent.withheld, 3);

  const capsule = await call("tools/call", { name: "vault_context_request", arguments: { requested_kinds: ["skill", "memory", "policy"] } });
  assert.equal(capsule.result.structuredContent.verification.ok, true);
  assert.equal(capsule.result.structuredContent.capsule.included_pages.length, 1);

  const proposal = await call("tools/call", { name: "vault_memory_propose", arguments: { content: "Prefer primary sources before secondary summaries.", source_model: "hermes-agent" } });
  assert.equal(proposal.result.structuredContent.proposal.status, "pending_owner_approval");

  const verify = await call("tools/call", { name: "vault_capsule_verify", arguments: { capsule: capsule.result.structuredContent.capsule } });
  assert.equal(verify.result.structuredContent.ok, true);

  console.log("agent-vault-mcp smoke passed");
} finally {
  child.kill();
}
