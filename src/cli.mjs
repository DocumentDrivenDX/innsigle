#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  b64url,
  b64urlDecode,
  generateEd25519,
  sha256Hex,
  signPayload,
  verifyPayload,
} from "./crypto.mjs";
import { loadJournal, mergeJournals, buildProvenance, proposeColo } from "./provenance/index.mjs";

const EXIT = { ok: 0, usage: 1, badSig: 2, contentMismatch: 3, badKey: 4, badSchema: 5 };

function usage(msg) {
  if (msg) console.error(msg);
  console.error(`innsigle — content origin seal (CONTRACT-001)

Usage:
  innsigle keygen --out-dir <dir>
  innsigle keys template --issuer-id <id> --issuer-name <name> --public-key <b64url> --key-id <id> [--out file]
  innsigle claim build --content <file> [--uri <uri>] --colo <colo.json> --issuer-id <id> --issuer-name <name> --key-id <id> --key-url <url> [--out file]
  innsigle sign --claim <file> --key <private.pem> [--out file]
  innsigle verify --attestation <file> --content <file> --keys <file>
  innsigle colo example --kind model-primary|human-authored|mixed
  innsigle provenance build --journal <jsonl> [--artifact <path>]... --generated-at <iso> [--out file]
  innsigle provenance propose-colo --provenance <l2.json> [--uri <url>] [--force-composition] [--notes t] [--out file]
`);
  process.exit(EXIT.usage);
}

function arg(args, name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}

/** Prefer --colo; accept --bill as transitional alias. */
function argColoPath(args) {
  return arg(args, "--colo") ?? arg(args, "--bill");
}

function requireArg(args, name) {
  const v = arg(args, name);
  if (!v) usage(`missing ${name}`);
  return v;
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function writeOut(path, data) {
  const s = data.endsWith("\n") ? data : data + "\n";
  if (path) writeFileSync(path, s);
  else process.stdout.write(s);
}

function cmdKeygen(args) {
  const outDir = requireArg(args, "--out-dir");
  mkdirSync(outDir, { recursive: true });
  const { publicKeyRaw, privateKeyPem, publicKeyPem, keyId } = generateEd25519();
  const privPath = join(outDir, "ed25519.priv.pem");
  writeFileSync(privPath, privateKeyPem);
  try {
    chmodSync(privPath, 0o600);
  } catch {
    /* ignore */
  }
  writeFileSync(join(outDir, "ed25519.pub.pem"), publicKeyPem);
  writeFileSync(join(outDir, "ed25519.pub.raw.b64url"), b64url(publicKeyRaw) + "\n");
  writeFileSync(join(outDir, "key-id.txt"), keyId + "\n");
  console.error(`key_id=${keyId}`);
  console.error(`private=${privPath}`);
}

/** ADR-003: absolute key_url for signed claims (https production; http/file test). */
function assertAbsoluteKeyUrl(keyUrl) {
  let u;
  try {
    u = new URL(keyUrl);
  } catch {
    console.error("INVALID: key_url must be absolute URL (ADR-003)");
    process.exit(EXIT.badSchema);
  }
  if (u.protocol !== "https:" && u.protocol !== "http:" && u.protocol !== "file:") {
    console.error("INVALID: key_url scheme must be https (or http/file for tests)");
    process.exit(EXIT.badSchema);
  }
  if (!u.protocol || !u.host && u.protocol !== "file:") {
    console.error("INVALID: key_url incomplete");
    process.exit(EXIT.badSchema);
  }
  return keyUrl;
}

function cmdKeysTemplate(args) {
  // ADR-003 issuer document (preferred); still readable by verify as keys list
  const doc = {
    innsigle_issuer: "1",
    issuer_id: requireArg(args, "--issuer-id"),
    issuer_name: requireArg(args, "--issuer-name"),
    keys: [
      {
        key_id: requireArg(args, "--key-id"),
        alg: "ed25519",
        public_key: requireArg(args, "--public-key"),
        created_at: nowIso(),
        revoked_at: null,
      },
    ],
    endorsements: [],
  };
  writeOut(arg(args, "--out"), JSON.stringify(doc, null, 2));
}

function cmdClaimBuild(args) {
  const contentPath = requireArg(args, "--content");
  const coloPath = argColoPath(args);
  if (!coloPath) usage("missing --colo <colo.json>");
  if (!existsSync(contentPath) || !existsSync(coloPath)) usage("content or colo file missing");
  const colophon = JSON.parse(readFileSync(coloPath, "utf8"));
  if (!colophon.composition || !Array.isArray(colophon.ingredients)) {
    console.error("INVALID: colophon schema");
    process.exit(EXIT.badSchema);
  }
  colophon.schema_version = "1";
  const uri = arg(args, "--uri");
  const keyUrl = assertAbsoluteKeyUrl(requireArg(args, "--key-url"));
  const payload = {
    innsigle: "1",
    type: "https://innsigle.dev/claim/colophon/v1",
    issued_at: nowIso(),
    issuer: {
      id: requireArg(args, "--issuer-id"),
      name: requireArg(args, "--issuer-name"),
      key_id: requireArg(args, "--key-id"),
      key_url: keyUrl,
    },
    subjects: [
      {
        ...(uri ? { uri } : {}),
        digest: { alg: "sha256", value: sha256Hex(readFileSync(contentPath)) },
      },
    ],
    colophon,
  };
  writeOut(arg(args, "--out"), JSON.stringify(payload, null, 2));
}

function cmdSign(args) {
  const payload = JSON.parse(readFileSync(requireArg(args, "--claim"), "utf8"));
  if (!payload?.issuer?.key_url) {
    console.error("INVALID: claim missing issuer.key_url (ADR-003)");
    process.exit(EXIT.badSchema);
  }
  assertAbsoluteKeyUrl(payload.issuer.key_url);
  const privateKeyPem = readFileSync(requireArg(args, "--key"), "utf8");
  const sig = signPayload(payload, privateKeyPem);
  const attestation = {
    payload,
    payload_encoding: "json",
    signatures: [
      {
        key_id: payload.issuer.key_id,
        alg: "ed25519",
        sig: b64url(sig),
        signed_at: nowIso(),
      },
    ],
  };
  writeOut(arg(args, "--out"), JSON.stringify(attestation, null, 2));
}

function cmdVerify(args) {
  let attestation;
  let keys;
  try {
    attestation = JSON.parse(readFileSync(requireArg(args, "--attestation"), "utf8"));
    keys = JSON.parse(readFileSync(requireArg(args, "--keys"), "utf8"));
  } catch {
    console.error("INVALID: schema/parse");
    process.exit(EXIT.badSchema);
  }
  const payload = attestation.payload;
  if (!payload?.innsigle || !attestation.signatures?.length) {
    console.error("INVALID: schema");
    process.exit(EXIT.badSchema);
  }
  // ADR-003: signed payload must carry absolute key_url (integrity of discovery channel)
  if (!payload.issuer?.key_url) {
    console.error("INVALID: missing issuer.key_url in signed payload");
    process.exit(EXIT.badSchema);
  }
  try {
    assertAbsoluteKeyUrl(payload.issuer.key_url);
  } catch {
    /* assertAbsoluteKeyUrl already exits */
  }
  // Accept innsigle_issuer or legacy innsigle_keys documents
  if (!keys.keys && !keys.innsigle_issuer && !keys.innsigle_keys) {
    console.error("INVALID: issuer document schema");
    process.exit(EXIT.badSchema);
  }
  const sigBlock = attestation.signatures[0];
  const key = keys.keys?.find((k) => k.key_id === sigBlock.key_id);
  if (!key) {
    console.error("INVALID: unknown_key");
    process.exit(EXIT.badKey);
  }
  if (key.revoked_at) {
    console.error("INVALID: revoked_key");
    process.exit(EXIT.badKey);
  }
  const contentHash = sha256Hex(readFileSync(requireArg(args, "--content")));
  const subject = payload.subjects?.[0];
  if (!subject?.digest?.value || subject.digest.value !== contentHash) {
    console.error("INVALID: content_mismatch");
    console.error(`composition=${payload.colophon?.composition ?? "?"}`);
    process.exit(EXIT.contentMismatch);
  }
  const ok = verifyPayload(payload, b64urlDecode(sigBlock.sig), b64urlDecode(key.public_key));
  if (!ok) {
    console.error("INVALID: bad_signature");
    process.exit(EXIT.badSig);
  }
  console.log("VALID");
  console.log(`issuer=${payload.issuer.id}`);
  console.log(`key_url=${payload.issuer.key_url}`);
  console.log(`composition=${payload.colophon.composition}`);
  console.log(`key_id=${sigBlock.key_id}`);
  process.exit(EXIT.ok);
}

function multiArg(args, name) {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && args[i + 1]) out.push(args[++i]);
  }
  return out;
}

function cmdProvenanceBuild(args) {
  const journalPaths = multiArg(args, "--journal");
  if (!journalPaths.length) usage("missing --journal <jsonl>");
  const artifacts = multiArg(args, "--artifact");
  const generatedAt = requireArg(args, "--generated-at");
  const out = arg(args, "--out");
  const sessionId = arg(args, "--session-id");
  const cwd = arg(args, "--cwd") || process.cwd();
  try {
    const lists = journalPaths.map((p) => loadJournal(p));
    const events = lists.length === 1 ? lists[0] : mergeJournals(lists);
    const l2 = buildProvenance(events, {
      generatedAt,
      sessionId,
      artifactPaths: artifacts.length ? artifacts : undefined,
      cwd,
      generator: {
        name: "innsigle-provenance",
        version: "0.1.0",
        uri: null,
      },
      harness: { name: arg(args, "--harness") || "cli", version: null },
    });
    const body = JSON.stringify(l2, null, 2) + "\n";
    writeOut(out, body);
    if (out) {
      console.error(`sha256=${sha256Hex(body)}`);
    }
  } catch (e) {
    console.error(`INVALID: ${e.message}`);
    process.exit(EXIT.badSchema);
  }
}

function cmdProvenanceProposeColo(args) {
  const provPath = requireArg(args, "--provenance");
  if (!existsSync(provPath)) usage("provenance file missing");
  const out = arg(args, "--out");
  const force = args.includes("--force-composition");
  const notes = arg(args, "--notes");
  const uri = arg(args, "--uri");
  try {
    const raw = readFileSync(provPath);
    const l2 = JSON.parse(raw.toString("utf8"));
    const digestHex = sha256Hex(raw);
    const colo = proposeColo(l2, {
      provenanceDigestHex: digestHex,
      provenanceUri: uri || null,
      forceComposition: force,
      notes: notes || null,
      composition: arg(args, "--composition") || undefined,
    });
    writeOut(out, JSON.stringify(colo, null, 2) + "\n");
  } catch (e) {
    console.error(`INVALID: ${e.message}`);
    process.exit(EXIT.badSchema);
  }
}

function cmdColoExample(args) {
  const kind = requireArg(args, "--kind");
  const colos = {
    "model-primary": {
      schema_version: "1",
      composition: "model-primary",
      ingredients: [
        { kind: "model", name: "Claude", role: "draft" },
        { kind: "tool", name: "sloptimizer", role: "rewrite" },
        { kind: "human", name: "operator", role: "structure-edit" },
      ],
      notes: null,
    },
    "human-authored": {
      schema_version: "1",
      composition: "human-authored",
      ingredients: [{ kind: "human", name: "operator", role: "author" }],
      notes: null,
    },
    mixed: {
      schema_version: "1",
      composition: "mixed",
      ingredients: [
        { kind: "human", name: "operator", role: "outline" },
        { kind: "model", name: "Claude", role: "expand" },
        { kind: "human", name: "operator", role: "final-edit" },
      ],
      notes: null,
    },
  };
  if (!colos[kind]) usage("kind must be model-primary|human-authored|mixed");
  writeOut(undefined, JSON.stringify(colos[kind], null, 2));
}

const argv = process.argv.slice(2);
const cmd = argv[0];
const rest = argv.slice(1);

switch (cmd) {
  case "keygen":
    cmdKeygen(rest);
    break;
  case "keys":
    if (rest[0] !== "template") usage();
    cmdKeysTemplate(rest.slice(1));
    break;
  case "claim":
    if (rest[0] !== "build") usage();
    cmdClaimBuild(rest.slice(1));
    break;
  case "sign":
    cmdSign(rest);
    break;
  case "verify":
    cmdVerify(rest);
    break;
  case "colo":
  case "bill": // transitional alias
    if (rest[0] !== "example") usage();
    cmdColoExample(rest.slice(1));
    break;
  case "provenance":
    if (rest[0] === "build") cmdProvenanceBuild(rest.slice(1));
    else if (rest[0] === "propose-colo") cmdProvenanceProposeColo(rest.slice(1));
    else usage("provenance build|propose-colo");
    break;
  default:
    usage();
}
