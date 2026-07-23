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

function cmdKeysTemplate(args) {
  const doc = {
    innsigle_keys: "1",
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
  const payload = {
    innsigle: "1",
    type: "https://innsigle.dev/claim/colophon/v1",
    issued_at: nowIso(),
    issuer: {
      id: requireArg(args, "--issuer-id"),
      name: requireArg(args, "--issuer-name"),
      key_id: requireArg(args, "--key-id"),
      key_url: requireArg(args, "--key-url"),
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
  console.log(`composition=${payload.colophon.composition}`);
  console.log(`key_id=${sigBlock.key_id}`);
  process.exit(EXIT.ok);
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
  default:
    usage();
}
