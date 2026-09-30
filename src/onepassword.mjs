import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Resolve the op command. INNSIGLE_OP_BIN may contain arguments
 * (e.g. INNSIGLE_OP_BIN="mac op" for the OrbStack host bridge):
 * split on whitespace, spawn argv[0], prepend the rest to args.
 * @returns {{ bin: string, preArgs: string[] }}
 */
export function opCommand() {
  const raw = (process.env.INNSIGLE_OP_BIN || "op").trim();
  const parts = raw.split(/\s+/).filter(Boolean);
  return { bin: parts[0] || "op", preArgs: parts.slice(1) };
}

/**
 * @returns {string} path to op binary (first word of INNSIGLE_OP_BIN)
 */
export function opBin() {
  return opCommand().bin;
}

/**
 * op rejects non-ASCII and `/` inside a secret reference, so a pretty item
 * title (innsigle's default contains a middle dot) produces a reference that
 * can never be read back. Use the human-readable name when it is valid in a
 * reference, otherwise fall back to the uuid, which is always safe and also
 * survives a rename.
 *
 * @param {string | undefined} name
 * @param {string | undefined} id
 * @returns {string}
 */
export function refSegment(name, id) {
  const safe = typeof name === "string" && /^[\x20-\x7E]+$/.test(name) && !name.includes("/");
  if (safe) return name;
  if (id) return id;
  throw Object.assign(
    new Error(`cannot build an op:// reference for ${JSON.stringify(name)}: not reference-safe and no id available`),
    { code: "OP_REF" },
  );
}

/**
 * @param {string[]} args
 * @param {{ input?: string, env?: NodeJS.ProcessEnv }} [opts]
 */
export function runOp(args, opts = {}) {
  const { bin, preArgs } = opCommand();
  const r = spawnSync(bin, [...preArgs, ...args], {
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

/**
 * Resolve which 1Password account a call should target: an explicit option
 * wins, then the OP_ACCOUNT env var, then op's own default account.
 * @param {{ account?: string }} [opts]
 * @returns {string | undefined}
 */
export function resolveAccount(opts = {}) {
  return opts.account || process.env.OP_ACCOUNT || undefined;
}

/**
 * Best-effort: can we actually reach the vault we are about to write to?
 *
 * This deliberately does not use `op whoami`. Under 1Password's desktop-app
 * integration there is no persistent session token, so `whoami` reports
 * "account is not signed in" even while reads and writes succeed via
 * biometric authorization. Probing with `op vault list` exercises the same
 * path a real call takes, and honours account selection the way
 * readPrivateKeyPem does.
 *
 * @param {{ account?: string }} [opts]
 */
export function assertOpSignedIn(opts = {}) {
  const account = resolveAccount(opts);
  const args = ["vault", "list", "--format=json"];
  if (account) args.push("--account", account);
  const r = runOp(args);
  if (r.status !== 0) {
    const msg = (r.stderr || r.stdout || "").trim() || "not signed in";
    const where = account ? ` for account ${account}` : "";
    const err = new Error(
      `1Password CLI is not authorized${where} (${msg}). Run: op signin  (or enable desktop app integration and approve the prompt)`,
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
 * @param {string} [p.account] 1Password account; defaults to OP_ACCOUNT
 * @returns {{ id: string, title: string, vault: { id?: string, name?: string }, privateKeyRef: string }}
 */
export function createHouseKeyItem(p) {
  assertOpAvailable();
  const account = resolveAccount(p);
  assertOpSignedIn({ account });

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
    // Must match the account readPrivateKeyPem will later read from,
    // otherwise the key is created in one account and looked up in another.
    if (account) args.push("--account", account);
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
    // Field label is the reference segment (spaces allowed, non-ASCII not).
    const vaultRef = refSegment(vaultName, item.vault?.id);
    const itemRef = refSegment(title, item.id);
    const privateKeyRef = `op://${vaultRef}/${itemRef}/private key`;
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
 * Account selection: opts.account (seal --op-account) wins, then OP_ACCOUNT
 * env; either appends `--account <value>` to `op read`.
 * @param {string} ref
 * @param {{ account?: string }} [opts]
 * @returns {string}
 */
export function readPrivateKeyPem(ref, opts = {}) {
  assertOpAvailable();
  const account = resolveAccount(opts);
  const args = ["read", ref];
  if (account) args.push("--account", account);
  const r = runOp(args);
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
