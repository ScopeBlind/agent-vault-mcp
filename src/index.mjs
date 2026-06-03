#!/usr/bin/env node
/**
 * ScopeBlind Agent Vault MCP adapter.
 *
 * This server is intentionally runtime-agnostic: Hermes, Claude Desktop,
 * Codex, or any MCP-capable agent can request signed context, propose memory
 * updates, and verify capsules without ScopeBlind becoming the agent runtime or
 * the memory database.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";

const VERSION = "0.1.0";
const DEFAULT_ROOT = process.env.SCOPEBLIND_AGENT_VAULT_ROOT || path.resolve(process.cwd(), "examples/agent-vault");
const DEFAULT_MANIFEST = process.env.SCOPEBLIND_AGENT_MANIFEST || path.join(DEFAULT_ROOT, "manifest.json");
const DEFAULT_PAGES = process.env.SCOPEBLIND_AGENT_PAGES || path.join(DEFAULT_ROOT, "signed-pages.json");
const DEFAULT_KEY_DIR = process.env.SCOPEBLIND_AGENT_VAULT_MCP_STATE || path.join(os.homedir(), ".scopeblind", "agent-vault-mcp");
const DEFAULT_STATE_FILE = path.join(DEFAULT_KEY_DIR, "runtime-key.json");

const PAGE_KINDS = new Set(["system_prompt", "skill", "memory", "rule", "policy", "dossier", "artifact", "session", "receipt"]);
const SENSITIVITY = new Set(["open", "token", "approval", "sealed"]);

const tools = [
  {
    name: "vault_manifest_get",
    description: "Read an Agent Vault manifest and return stable identity/state hashes for a runtime like Hermes or GBrain.",
    inputSchema: objectSchema({
      manifest_path: optionalString("Path to manifest.json. Defaults to SCOPEBLIND_AGENT_MANIFEST or examples/agent-vault/manifest.json."),
      include_raw: optionalBoolean("Return the full manifest object."),
    }),
  },
  {
    name: "vault_pages_list",
    description: "List signed Agent Vault pages with sensitivity labels; content is redacted unless requested.",
    inputSchema: objectSchema({
      pages_path: optionalString("Path to signed-pages.json."),
      include_content: optionalBoolean("Include page content. Defaults to false."),
      kinds: optionalArray("Filter by page kind.", { type: "string" }),
    }),
  },
  {
    name: "vault_disclosure_policy_check",
    description: "Explain which pages would be disclosed, withheld, or sealed for a requested set of kinds and auth proof.",
    inputSchema: objectSchema({
      pages_path: optionalString("Path to signed-pages.json."),
      requested_kinds: optionalArray("Requested page kinds. Defaults to skill, memory, policy.", { type: "string" }),
      auth_proof: optionalObject("BRASS auth proof or demo proof."),
    }),
  },
  {
    name: "vault_context_request",
    description: "Issue a signed Context Capsule: only allowed pages are disclosed; sealed pages remain committed but hidden.",
    inputSchema: objectSchema({
      manifest_path: optionalString("Path to manifest.json."),
      pages_path: optionalString("Path to signed-pages.json."),
      requested_kinds: optionalArray("Requested page kinds. Defaults to skill, memory, policy.", { type: "string" }),
      requester: optionalObject("Requester descriptor: { kind, id, label }."),
      auth_proof: optionalObject("BRASS proof. Demo stub accepted only when SCOPEBLIND_AGENT_VAULT_ALLOW_DEMO_AUTH=true."),
      expires_at: optionalString("ISO-8601 expiry timestamp. Defaults to +24h."),
      output_path: optionalString("Optional path to write the capsule JSON."),
    }),
  },
  {
    name: "vault_capsule_verify",
    description: "Verify a Context Capsule signature and included signed page signatures offline.",
    inputSchema: objectSchema({
      capsule_path: optionalString("Path to context-capsule.json. If omitted, pass capsule inline."),
      capsule: optionalObject("Inline context capsule object."),
      verify_pages: optionalBoolean("Verify included page signatures. Defaults to true."),
    }),
  },
  {
    name: "vault_memory_propose",
    description: "Create a signed memory proposal. It does not mutate the Vault; the owner must approve before the State Sigil should change.",
    inputSchema: objectSchema({
      manifest_path: optionalString("Path to manifest.json."),
      pages_path: optionalString("Path to signed-pages.json."),
      content: requiredString("Proposed memory content."),
      sensitivity: optionalString("open | token | approval | sealed. Defaults to approval."),
      source_model: optionalString("Runtime/model proposing the memory update."),
      source_session: optionalString("External chat/session identifier."),
      output_path: optionalString("Optional path to write the proposal JSON."),
    }, ["content"]),
  },
  {
    name: "vault_page_sign",
    description: "Sign a page payload with an explicit agent secret. This is for owner-approved writes only, not automatic memory writes.",
    inputSchema: objectSchema({
      page: requiredObject("Unsigned page payload."),
      agent_secret_hex: optionalString("32-byte Ed25519 secret hex. Defaults to SCOPEBLIND_AGENT_SECRET_HEX."),
      kid: optionalString("Signing key id. Defaults to page.signature.kid or manifest passport_kid."),
    }, ["page"]),
  },
  {
    name: "vault_capsule_export",
    description: "Alias for vault_context_request, provided for runtimes that distinguish context requests from export operations.",
    inputSchema: objectSchema({
      manifest_path: optionalString("Path to manifest.json."),
      pages_path: optionalString("Path to signed-pages.json."),
      requested_kinds: optionalArray("Requested page kinds.", { type: "string" }),
      requester: optionalObject("Requester descriptor."),
      auth_proof: optionalObject("BRASS proof or demo proof."),
      output_path: optionalString("Optional path to write the capsule JSON."),
    }),
  },
];

const handlers = {
  vault_manifest_get,
  vault_pages_list,
  vault_disclosure_policy_check,
  vault_context_request,
  vault_capsule_verify,
  vault_memory_propose,
  vault_page_sign,
  vault_capsule_export: vault_context_request,
};

async function vault_manifest_get(args = {}) {
  const manifest = readJson(args.manifest_path || DEFAULT_MANIFEST);
  return {
    agent_id: manifest.agent_id,
    handle: manifest.handle,
    display_name: manifest.display_name,
    crest_hash: manifest.crest_hash,
    state_hash: manifest.state_hash,
    parent_manifest_hash: manifest.parent_manifest_hash || null,
    passport_kid: manifest.passport_kid,
    signature: summarizeSignature(manifest.signature),
    raw: args.include_raw ? manifest : undefined,
  };
}

async function vault_pages_list(args = {}) {
  const pages = readPages(args.pages_path || DEFAULT_PAGES);
  const kinds = normalizeKinds(args.kinds || [], null);
  const filtered = kinds ? pages.filter((page) => kinds.includes(page.kind)) : pages;
  return {
    count: filtered.length,
    pages: filtered.map((page) => summarizePage(page, Boolean(args.include_content))),
  };
}

async function vault_disclosure_policy_check(args = {}) {
  const pages = readPages(args.pages_path || DEFAULT_PAGES);
  const requestedKinds = normalizeKinds(args.requested_kinds, ["skill", "memory", "policy"]);
  const authResult = evaluateAuth(args.auth_proof, "context:read:model");
  const decisions = pages
    .filter((page) => requestedKinds.includes(page.kind))
    .map((page) => {
      const disclose = canDisclosePage(page, authResult);
      return {
        page_id: page.page_id,
        kind: page.kind,
        sensitivity: page.sensitivity,
        decision: disclose ? "disclose" : "withhold",
        reason: disclose ? authResult.reason : disclosureReason(page, authResult),
      };
    });
  const sealed = pages
    .filter((page) => page.sensitivity === "sealed" && !decisions.some((decision) => decision.page_id === page.page_id))
    .map((page) => ({ page_id: page.page_id, kind: page.kind, sensitivity: page.sensitivity, decision: "withhold", reason: "sealed" }));
  return {
    auth_result: authResult,
    requested_kinds: requestedKinds,
    disclosed: decisions.filter((decision) => decision.decision === "disclose").length,
    withheld: decisions.filter((decision) => decision.decision === "withhold").length + sealed.length,
    decisions: [...decisions, ...sealed],
  };
}

async function vault_context_request(args = {}) {
  const manifest = readJson(args.manifest_path || DEFAULT_MANIFEST);
  const pages = readPages(args.pages_path || DEFAULT_PAGES);
  const requestedKinds = normalizeKinds(args.requested_kinds, ["skill", "memory", "policy"]);
  const requester = normalizeRequester(args.requester);
  const authProof = normalizeAuthProof(args.auth_proof);
  const authResultBase = evaluateAuth(authProof, "context:read:model");
  const requestedPages = pages.filter((page) => requestedKinds.includes(page.kind));
  const includedPages = requestedPages.filter((page) => canDisclosePage(page, authResultBase));
  const explicitRedactions = requestedPages
    .filter((page) => !canDisclosePage(page, authResultBase))
    .map((page) => ({ page_id: page.page_id, reason: disclosureReason(page, authResultBase), sensitivity: page.sensitivity }));
  const sealedRedactions = pages
    .filter((page) => page.sensitivity === "sealed" && !explicitRedactions.some((redaction) => redaction.page_id === page.page_id))
    .map((page) => ({ page_id: page.page_id, reason: "sealed", sensitivity: page.sensitivity }));
  const redactions = [...explicitRedactions, ...sealedRedactions];
  const authResult = {
    ...authResultBase,
    disclosed_sensitive_pages: includedPages.filter((page) => page.sensitivity === "token" || page.sensitivity === "approval").length,
    withheld_sensitive_pages: redactions.filter((page) => page.sensitivity === "token" || page.sensitivity === "approval").length,
  };
  const payload = {
    type: "scopeblind.context_capsule.v1",
    agent_id: manifest.agent_id,
    request_id: `ctxreq-mcp-${Date.now().toString(36)}`,
    handle: manifest.handle,
    state_hash: manifest.state_hash,
    included_pages: includedPages,
    redactions,
    committed_but_hidden_fields: Array.from(new Set(redactions.map(hiddenFieldForPage))),
    requester,
    requested_kinds: requestedKinds,
    expires_at: args.expires_at || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    auth_proof: authProof,
    auth_result: authResult,
    receipt: {
      type: "scopeblind.context_receipt.v1",
      manifest_hash: hash(manifest),
      verified_at: new Date().toISOString(),
      runtime_issuer_kid: runtimeKid(),
      runtime: "agent-vault-mcp",
    },
  };
  const capsule = { ...payload, signature: signRuntime(payload) };
  if (args.output_path) writeJson(args.output_path, capsule);
  return {
    capsule,
    verification: verifyCapsule(capsule, true),
    written_to: args.output_path || null,
  };
}

async function vault_capsule_verify(args = {}) {
  const capsule = args.capsule_path ? readJson(args.capsule_path) : args.capsule;
  if (!capsule || typeof capsule !== "object") throw new Error("capsule_path or capsule required");
  return verifyCapsule(capsule, args.verify_pages !== false);
}

async function vault_memory_propose(args = {}) {
  if (!args.content || typeof args.content !== "string") throw new Error("content required");
  const manifest = readJson(args.manifest_path || DEFAULT_MANIFEST);
  const pages = readPages(args.pages_path || DEFAULT_PAGES);
  const sensitivity = normalizeSensitivity(args.sensitivity || "approval");
  const previous = pages.length ? pages[pages.length - 1] : null;
  const now = new Date().toISOString();
  const draftPage = {
    type: "scopeblind.signed_page.v1",
    page_id: `memory/proposed-${Date.now().toString(36)}`,
    agent_id: manifest.agent_id,
    kind: "memory",
    chain_id: previous?.chain_id || "main",
    previous_hash: previous?.page_hash || null,
    page_hash: "pending",
    state_hash: "pending-owner-approval",
    sensitivity,
    audiences: ["owner", "model"],
    committed_fields: ["content"],
    disclosed_fields: sensitivity === "sealed" ? [] : ["content"],
    superseded_by: null,
    delegated_from: null,
    source_model: args.source_model || "external-agent-runtime",
    source_session: args.source_session || null,
    expires_at: null,
    created_at: now,
    content: args.content,
  };
  const pageHash = hash({ ...draftPage, page_hash: undefined, state_hash: undefined });
  const proposedPage = { ...draftPage, page_hash: pageHash };
  const payload = {
    type: "scopeblind.memory_proposal.v1",
    agent_id: manifest.agent_id,
    handle: manifest.handle,
    proposed_at: now,
    status: "pending_owner_approval",
    current_state_hash: manifest.state_hash,
    proposed_page: proposedPage,
    proposed_state_hash: hash([...pages.map((page) => page.page_hash), pageHash]),
    note: "This proposal is runtime-signed but does not mutate the Vault. The owner must sign/approve the page before it becomes canonical memory.",
  };
  const proposal = { ...payload, signature: signRuntime(payload) };
  if (args.output_path) writeJson(args.output_path, proposal);
  return { proposal, written_to: args.output_path || null };
}

async function vault_page_sign(args = {}) {
  if (!args.page || typeof args.page !== "object") throw new Error("page required");
  const secretHex = args.agent_secret_hex || process.env.SCOPEBLIND_AGENT_SECRET_HEX;
  if (!secretHex) {
    return {
      ok: false,
      reason: "agent_secret_required",
      note: "Automatic runtimes should call vault_memory_propose. Only the Vault owner should sign canonical pages.",
    };
  }
  const secret = hexToBytes(stripShaPrefix(secretHex));
  if (secret.length !== 32) throw new Error("agent_secret_hex must be 32 bytes");
  const { signature: _ignored, ...payload } = args.page;
  const page = { ...payload, signature: signPayload(payload, secret, args.kid || args.page?.signature?.kid || "did:key:owner#agent-page") };
  return { ok: true, page, valid: verifySignedObject(page) };
}

function verifyCapsule(capsule, verifyPages = true) {
  const capsuleValid = verifySignedObject(capsule);
  const pageResults = verifyPages
    ? (capsule.included_pages || []).map((page) => ({ page_id: page.page_id, valid: verifySignedObject(page), alg: page.signature?.alg || null }))
    : [];
  return {
    ok: capsuleValid && pageResults.every((result) => result.valid),
    capsule_valid: capsuleValid,
    algorithm: capsule.signature?.alg || null,
    agent_id: capsule.agent_id,
    state_hash: capsule.state_hash,
    request_id: capsule.request_id,
    included_pages: (capsule.included_pages || []).length,
    hidden_fields: capsule.committed_but_hidden_fields || [],
    auth_gate: capsule.auth_result || null,
    page_results: pageResults,
  };
}

function evaluateAuth(authProof, requiredScope) {
  const base = {
    ok: false,
    tier: "none",
    reason: "auth_proof_missing",
    enforced: true,
    verifier: "agent-vault-mcp-local-policy",
    scope: requiredScope,
    disclosed_sensitive_pages: 0,
    withheld_sensitive_pages: 0,
  };
  if (!authProof || authProof.type === "none") return base;
  if (authProof.scope !== requiredScope) return { ...base, reason: "auth_scope_mismatch" };
  if (authProof.expires_at && Date.parse(authProof.expires_at) <= Date.now()) {
    return { ...base, tier: authProof.type === "brass-v2" ? "brass-v2" : "demo", reason: "auth_proof_expired" };
  }
  if (authProof.type === "brass-demo-stub") {
    if (process.env.SCOPEBLIND_AGENT_VAULT_ALLOW_DEMO_AUTH === "true") {
      return { ...base, ok: true, tier: "demo", reason: "demo_stub_accepted_by_local_env" };
    }
    return { ...base, tier: "demo", reason: "demo_auth_disabled" };
  }
  if (authProof.type === "brass-v2" && (authProof.verified === true || authProof.dleq_verified === true)) {
    return { ...base, ok: true, tier: "brass-v2", reason: "brass_v2_verified" };
  }
  if (authProof.type === "brass-v2") return { ...base, tier: "brass-v2", reason: "brass_v2_not_verified_locally" };
  return { ...base, reason: "unsupported_auth_proof_type" };
}

function canDisclosePage(page, authResult) {
  if (page?.sensitivity === "sealed") return false;
  if (page?.sensitivity === "open") return true;
  return Boolean(authResult?.ok);
}

function disclosureReason(page, authResult) {
  if (page?.sensitivity === "sealed") return "sealed";
  if ((page?.sensitivity === "token" || page?.sensitivity === "approval") && !authResult?.ok) return "auth_proof_required";
  return authResult?.reason || "withheld";
}

function hiddenFieldForPage(page) {
  if (page?.page_id === "prompt/main") return "system_prompt.content";
  return `${page?.page_id || "page"}.content`;
}

function summarizePage(page, includeContent) {
  return {
    page_id: page.page_id,
    kind: page.kind,
    sensitivity: page.sensitivity,
    page_hash: page.page_hash,
    state_hash: page.state_hash,
    previous_hash: page.previous_hash || null,
    signature: summarizeSignature(page.signature),
    content: includeContent ? page.content : undefined,
  };
}

function summarizeSignature(signature) {
  return signature ? { alg: signature.alg, kid: signature.kid, public_key: preview(signature.public_key), sig: preview(signature.sig) } : null;
}

function normalizeRequester(requester) {
  if (!requester || typeof requester !== "object") return { kind: "model_session", id: "mcp-runtime", label: "MCP runtime" };
  return {
    kind: requester.kind || "model_session",
    id: requester.id || null,
    label: requester.label || null,
  };
}

function normalizeAuthProof(authProof) {
  if (!authProof || typeof authProof !== "object") return { type: "none", scope: "context:read:model", nonce: "missing" };
  return {
    type: authProof.type || "none",
    scope: authProof.scope || "context:read:model",
    nonce: authProof.nonce || `nonce-${Date.now().toString(36)}`,
    verifier: authProof.verifier,
    nullifier: authProof.nullifier,
    proof: authProof.proof,
    verified: authProof.verified,
    dleq_verified: authProof.dleq_verified,
    expires_at: authProof.expires_at || null,
  };
}

function normalizeKinds(kinds, fallback) {
  const list = Array.isArray(kinds) && kinds.length ? kinds : fallback;
  if (!list) return null;
  const normalized = list.map(String).filter((kind) => PAGE_KINDS.has(kind));
  if (!normalized.length) throw new Error("requested_kinds contains no supported page kinds");
  return normalized;
}

function normalizeSensitivity(value) {
  const sensitivity = String(value || "approval");
  if (!SENSITIVITY.has(sensitivity)) throw new Error("sensitivity must be open, token, approval, or sealed");
  return sensitivity;
}

function readPages(file) {
  const pages = readJson(file);
  if (!Array.isArray(pages)) throw new Error(`expected array of signed pages at ${file}`);
  return pages;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(path.resolve(file), `${JSON.stringify(value, null, 2)}\n`);
}

function jcs(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(jcs).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${jcs(value[key])}`).join(",")}}`;
}

function hash(value) {
  const text = typeof value === "string" ? value : jcs(value);
  return `sha256:${bytesToHex(sha256(utf8ToBytes(text)))}`;
}

function signRuntime(payload) {
  const { secret, kid } = loadRuntimeKey();
  return signPayload(payload, secret, kid);
}

function signPayload(payload, secret, kid) {
  const digest = sha256(utf8ToBytes(jcs(payload)));
  const publicKey = ed25519.getPublicKey(secret);
  return {
    alg: "Ed25519",
    kid,
    public_key: bytesToHex(publicKey),
    sig: bytesToHex(ed25519.sign(digest, secret)),
  };
}

function verifySignedObject(obj) {
  if (!obj || typeof obj !== "object" || !obj.signature) return false;
  const { signature, ...payload } = obj;
  if (signature.alg !== "Ed25519" || !signature.public_key || !signature.sig) return false;
  try {
    const digest = sha256(utf8ToBytes(jcs(payload)));
    return ed25519.verify(hexToBytes(signature.sig), digest, hexToBytes(signature.public_key));
  } catch {
    return false;
  }
}

function loadRuntimeKey() {
  const inline = process.env.SCOPEBLIND_AGENT_VAULT_MCP_SECRET_HEX;
  if (inline) {
    const secret = hexToBytes(stripShaPrefix(inline));
    if (secret.length !== 32) throw new Error("SCOPEBLIND_AGENT_VAULT_MCP_SECRET_HEX must be 32 bytes");
    return { secret, kid: process.env.SCOPEBLIND_AGENT_VAULT_MCP_KID || "did:web:localhost#agent-vault-mcp" };
  }
  if (fs.existsSync(DEFAULT_STATE_FILE)) {
    const saved = JSON.parse(fs.readFileSync(DEFAULT_STATE_FILE, "utf8"));
    return { secret: hexToBytes(saved.secret_hex), kid: saved.kid };
  }
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const kid = process.env.SCOPEBLIND_AGENT_VAULT_MCP_KID || `did:key:agent-vault-mcp#${bytesToHex(ed25519.getPublicKey(secret)).slice(0, 16)}`;
  fs.mkdirSync(DEFAULT_KEY_DIR, { recursive: true });
  fs.writeFileSync(DEFAULT_STATE_FILE, JSON.stringify({ kid, secret_hex: bytesToHex(secret), created_at: new Date().toISOString() }, null, 2));
  return { secret, kid };
}

function runtimeKid() {
  return loadRuntimeKey().kid;
}

function stripShaPrefix(value) {
  return String(value).replace(/^sha256:/, "");
}

function preview(value) {
  if (!value || typeof value !== "string") return value || null;
  return value.length > 24 ? `${value.slice(0, 12)}...${value.slice(-8)}` : value;
}

function objectSchema(properties, required = []) {
  return { type: "object", additionalProperties: false, properties, required };
}
function requiredString(description) { return { type: "string", description }; }
function optionalString(description) { return { type: "string", description }; }
function optionalBoolean(description) { return { type: "boolean", description }; }
function optionalObject(description) { return { type: "object", description, additionalProperties: true }; }
function requiredObject(description) { return { type: "object", description, additionalProperties: true }; }
function optionalArray(description, items) { return { type: "array", description, items }; }

async function dispatch(method, params = {}) {
  if (method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "scopeblind-agent-vault-mcp", version: VERSION },
    };
  }
  if (method === "tools/list") return { tools };
  if (method === "tools/call") {
    const name = params.name;
    if (!handlers[name]) throw new Error(`unknown tool: ${name}`);
    const result = await handlers[name](params.arguments || {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  }
  if (method === "ping") return {};
  throw new Error(`unsupported method: ${method}`);
}

let buffer = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  drain().catch((err) => {
    send({ jsonrpc: "2.0", id: null, error: { code: -32603, message: err.message } });
  });
});

async function drain() {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const header = buffer.subarray(0, headerEnd).toString("utf8");
    const match = /Content-Length:\s*(\d+)/i.exec(header);
    if (!match) throw new Error("missing Content-Length header");
    const length = Number(match[1]);
    const start = headerEnd + 4;
    if (buffer.length < start + length) return;
    const body = buffer.subarray(start, start + length).toString("utf8");
    buffer = buffer.subarray(start + length);
    const message = JSON.parse(body);
    if (message.method && message.id === undefined) continue;
    handleMessage(message).catch((err) => send({ jsonrpc: "2.0", id: message.id ?? null, error: { code: -32603, message: err.message } }));
  }
}

async function handleMessage(message) {
  if (!message.method) return;
  try {
    const result = await dispatch(message.method, message.params || {});
    send({ jsonrpc: "2.0", id: message.id, result });
  } catch (err) {
    send({ jsonrpc: "2.0", id: message.id, error: { code: -32603, message: err.message } });
  }
}

function send(message) {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

if (process.argv.includes("--self-test")) {
  process.env.SCOPEBLIND_AGENT_VAULT_MCP_SECRET_HEX ||= "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
  process.env.SCOPEBLIND_AGENT_VAULT_MCP_KID ||= "did:key:self-test#agent-vault-mcp";
  const manifest = await vault_manifest_get({ include_raw: false });
  const capsule = await vault_context_request({ requested_kinds: ["skill", "memory", "policy"] });
  const verified = await vault_capsule_verify({ capsule: capsule.capsule });
  console.log(JSON.stringify({ manifest, verified }, null, 2));
  process.exit(verified.ok ? 0 : 1);
}
