import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * @returns {string} path to op binary
 */
export function opBin() {
  return process.env.INNSIGLE_OP_BIN || "op";
}

/**
 * @param {string[]} args
 * @param {{ input?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
export function runOp(args, opts = {}) {
  const r = spawnSync(opBin(), args, {
    encoding: "utf8",
    input: opts.input,
    env: { ...process.env, ...opts.env },
  });
  return r;
}

export function assertOpAvailable() {
  const r = runOp(["--version"]);
  if (r.error?.code === "ENOENT" || r.status === null) {
    const err = new Error(
      "1Password CLI (op) not found. Install: https://developer.1password.com/docs/cli/get-started/",
    );
    err.code = "OP_MISSING";
    throw err;
  }
  if (r.status !== 0) {
    const err = new Error(`op failed: ${(r.stderr || r.stdout || "").trim()}`);
    err.code = "OP_ERROR";
    throw err;
  }
}

/** Best-effort: is the CLI signed in? */
export function assertOpSignedIn() {
  const r = runOp(["whoami", "--format=json"]);
  if (r.status !== 0) {
    const msg = (r.stderr || r.stdout || "").trim() || "not signed in";
    const err = new Error(
      `1Password CLI is not signed in (${msg}). Run: op signin  (or enable desktop app integration)`,
    );
    err.code = "OP_AUTH";
    throw err;
  }
}

/**
 * Create a Secure Note holding the house private key + public metadata.
 * Private key is stored as a CONCEALED field "private key".
 *
 * @param {object} p
 * @param {string} p.title
 * @param {string} [p.vault]
 * @param {string} p.privateKeyPem
 * @param {string} p.keyId
 * @param {string} p.publicKeyB64url
 * @param {string} [p.issuerId]
 * @param {string} [p.notes]
 * @returns {{ id: string, title: string, vault: { id?: string, name?: string }, privateKeyRef: string }}
 */
export function createHouseKeyItem(p) {
  assertOpAvailable();
  assertOpSignedIn();

  const notes =
    p.notes ||
    [
      "Innsigle house key — private material for content seals.",
      "Do not commit this item export to git.",
      `key_id=${p.keyId}`,
      p.issuerId ? `issuer_id=${p.issuerId}` : null,
    ]
      .filter(Boolean)
      .join("\n");

  const template = {
    category: "SECURE_NOTE",
    title: p.title,
    tags: ["innsigle"],
    fields: [
      {
        id: "notesPlain",
        type: "STRING",
        purpose: "NOTES",
        label: "notesPlain",
        value: notes,
      },
      {
        id: "private_key",
        type: "CONCEALED",
        label: "private key",
        value: p.privateKeyPem.replace(/\r\n/g, "\n").trim() + "\n",
      },
      {
        id: "key_id",
        type: "STRING",
        label: "key_id",
        value: p.keyId,
      },
      {
        id: "public_key",
        type: "STRING",
        label: "public_key",
        value: p.publicKeyB64url,
      },
    ],
  };

  const dir = mkdtempSync(join(tmpdir(), "innsigle-op-"));
  const templatePath = join(dir, "item.json");
  try {
    writeFileSync(templatePath, JSON.stringify(template), { mode: 0o600 });
    const args = ["item", "create", "--template", templatePath, "--format=json"];
    if (p.vault) args.push("--vault", p.vault);
    const r = runOp(args);
    if (r.status !== 0) {
      const err = new Error(
        `op item create failed: ${(r.stderr || r.stdout || "").trim()}`,
      );
      err.code = "OP_CREATE";
      throw err;
    }
    let item;
    try {
      item = JSON.parse(r.stdout);
    } catch {
      const err = new Error("op item create returned non-JSON");
      err.code = "OP_CREATE";
      throw err;
    }
    const vaultName = item.vault?.name || p.vault || "Private";
    const title = item.title || p.title;
    // Field label is the reference segment (spaces allowed).
    const privateKeyRef = `op://${vaultName}/${title}/private key`;
    return {
      id: item.id,
      title,
      vault: item.vault || { name: vaultName },
      privateKeyRef,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Read private key PEM from an op:// reference.
 * @param {string} ref
 * @returns {string}
 */
export function readPrivateKeyPem(ref) {
  assertOpAvailable();
  const r = runOp(["read", ref]);
  if (r.status !== 0) {
    const err = new Error(
      `op read failed for ${ref}: ${(r.stderr || r.stdout || "").trim()}`,
    );
    err.code = "OP_READ";
    throw err;
  }
  const pem = (r.stdout || "").trim() + "\n";
  if (!pem.includes("BEGIN") || !pem.includes("PRIVATE KEY")) {
    const err = new Error(
      `op read ${ref}: expected a PEM private key, got something else`,
    );
    err.code = "OP_READ";
    throw err;
  }
  return pem;
}
