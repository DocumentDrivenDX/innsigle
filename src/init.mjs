import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { b64url, generateEd25519 } from "./crypto.mjs";
import {
  CONFIG_BASENAME,
  CONFIG_SCHEMA,
  DIR_NAME,
  PATHS,
  defaultIssuerId,
  writeConfig,
} from "./config.mjs";
import { createHouseKeyItem } from "./onepassword.mjs";

/**
 * @param {string[]} args
 * @param {{ nowIso: () => string, log?: (s: string) => void, err?: (s: string) => void }} deps
 * @returns {number} exit code
 */
export function runInit(args, deps) {
  const log = deps.log || ((s) => console.error(s));
  const err = deps.err || ((s) => console.error(s));

  const hasOnePassword = args.includes("--onepassword") || args.includes("--1password");
  if (!hasOnePassword) {
    err("init requires --onepassword (house key custody in 1Password)");
    err("Usage: innsigle init --onepassword [--dir <repo>] \\");
    err("         [--issuer-id <id>] [--issuer-name <name>] [--site-url <https://…>] \\");
    err("         [--vault <name>] [--title <item title>] [--force]");
    return 1;
  }

  const dir = resolve(arg(args, "--dir") || process.cwd());
  if (!existsSync(dir)) {
    err(`INVALID: --dir does not exist: ${dir}`);
    return 1;
  }

  const innsigleDir = join(dir, DIR_NAME);
  const configPath = join(innsigleDir, CONFIG_BASENAME);
  if (existsSync(configPath) && !args.includes("--force")) {
    err(
      `INVALID: ${PATHS.config} already exists (use --force to replace metadata; does not delete the 1Password item)`,
    );
    return 1;
  }

  const issuerId = arg(args, "--issuer-id") || defaultIssuerId(dir);
  const issuerName =
    arg(args, "--issuer-name") ||
    basename(dir).replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ||
    issuerId;

  const siteUrl = arg(args, "--site-url") || arg(args, "--key-url-base");
  let keyUrl = arg(args, "--key-url");
  if (!keyUrl && siteUrl) {
    const base = siteUrl.replace(/\/+$/, "");
    keyUrl = `${base}/.well-known/innsigle/keys.json`;
  }
  if (keyUrl) {
    try {
      const u = new URL(keyUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:" && u.protocol !== "file:") {
        err("INVALID: --key-url must be absolute https (or http/file for tests)");
        return 5;
      }
    } catch {
      err("INVALID: --key-url must be an absolute URL");
      return 5;
    }
  } else {
    keyUrl = "https://example.invalid/.well-known/innsigle/keys.json";
    log(
      `warn: no --site-url / --key-url; wrote placeholder key_url — edit ${PATHS.config} before signing claims`,
    );
  }

  const vault = arg(args, "--vault");
  const title = arg(args, "--title") || `Innsigle · ${issuerId}`;

  const { publicKeyRaw, privateKeyPem, keyId } = generateEd25519();
  const publicKeyB64url = b64url(publicKeyRaw);

  let opItem;
  try {
    opItem = createHouseKeyItem({
      title,
      vault,
      privateKeyPem,
      keyId,
      publicKeyB64url,
      issuerId,
    });
  } catch (e) {
    err(`INVALID: ${e.message}`);
    return 1;
  }

  const publicDir = join(dir, DIR_NAME, "public");
  const claimsDir = join(publicDir, "claims");
  mkdirSync(claimsDir, { recursive: true });

  // .innsigle-scoped gitignore: debug sidecars (seal --debug-claim) and
  // transcript-derived provenance L2 data (provenance sync / seal --auto)
  // stay local — publish provenance only deliberately, after review.
  writeFileSync(join(dir, DIR_NAME, ".gitignore"), "debug/\nprovenance/\n");

  const issuerDoc = {
    innsigle_issuer: "1",
    issuer_id: issuerId,
    issuer_name: issuerName,
    keys: [
      {
        key_id: keyId,
        alg: "ed25519",
        public_key: publicKeyB64url,
        created_at: deps.nowIso(),
        revoked_at: null,
      },
    ],
    endorsements: [],
  };
  writeFileSync(join(publicDir, "keys.json"), JSON.stringify(issuerDoc, null, 2) + "\n");
  writeFileSync(join(dir, PATHS.readme), buildReadme({ issuerId, keyId, keyUrl }));
  writeFileSync(join(dir, PATHS.agents), buildAgentsDoc({ issuerId, keyId, keyUrl }));

  const config = {
    schema_version: CONFIG_SCHEMA,
    issuer: {
      id: issuerId,
      name: issuerName,
      key_id: keyId,
      key_url: keyUrl,
      public_key: publicKeyB64url,
    },
    /** Staging for publish: map this tree to site `/.well-known/innsigle/`. */
    paths: {
      public: PATHS.public,
      keys: PATHS.keys,
      claims_dir: PATHS.claims_dir,
    },
    publish: {
      /** Required public URL path for keys.json after deploy. */
      site_keys_path: "/.well-known/innsigle/keys.json",
      /** Copy rule agents should implement (source → deploy destination). */
      copy: {
        from: PATHS.public,
        to: ".well-known/innsigle",
      },
    },
    onepassword: {
      vault: opItem.vault?.name || vault || null,
      item_title: opItem.title,
      item_id: opItem.id,
      private_key_ref: opItem.privateKeyRef,
    },
  };
  writeConfig(configPath, config);

  log(`ok: wrote ${PATHS.config}`);
  log(`ok: wrote ${PATHS.keys}`);
  log(`ok: wrote ${PATHS.readme} and ${PATHS.agents}`);
  log(`key_id=${keyId}`);
  log(`onepassword=${opItem.privateKeyRef}`);
  log(`item_id=${opItem.id}`);
  if (keyUrl.includes("example.invalid")) {
    log(`next: set issuer.key_url in ${PATHS.config} to your public HTTPS keys URL`);
  } else {
    log(
      "next: wire .innsigle/public → /.well-known/innsigle in your build (see .innsigle/AGENTS.md), then claim + sign",
    );
  }
  return 0;
}

function buildReadme({ issuerId, keyId, keyUrl }) {
  return `# Innsigle project state

This directory is owned by the Innsigle CLI. **Do not put private keys here.**

| Path | Purpose |
|------|---------|
| \`config.json\` | Issuer metadata, key fingerprint, 1Password ref (commit-safe) |
| \`public/\` | **Public** files to publish at site \`/.well-known/innsigle/\` |
| \`public/keys.json\` | Issuer document (public keys only) |
| \`public/claims/\` | Optional attestations after you sign content |
| \`provenance/\` | Transcript-derived session data (prompt counts, file paths) — **local only**, gitignored; publish only deliberately after review |
| \`AGENTS.md\` | Instructions for agents wiring this into a build |

## Custody

- **Private key:** 1Password only (see \`config.json\` → \`onepassword.private_key_ref\`)
- **Public key / fingerprint:** \`config.json\` and \`public/keys.json\`
- **key_id:** \`${keyId}\`
- **issuer_id:** \`${issuerId}\`
- **Published key_url (after deploy):** \`${keyUrl}\`

## Publish contract

Innsigle does **not** know Quarto, Hugo, Next, GitHub Pages, etc.

Your build (or an agent) MUST copy:

\`\`\`text
.innsigle/public/  →  <site-root>/.well-known/innsigle/
\`\`\`

so that \`keys.json\` is served at:

\`\`\`text
https://<your-host>/.well-known/innsigle/keys.json
\`\`\`

That URL must match \`issuer.key_url\` in \`config.json\` (frozen into signed claims).

See **AGENTS.md** for a checklist agents can follow.
`;
}

function buildAgentsDoc({ issuerId, keyId, keyUrl }) {
  return `# Agent instructions: Innsigle publish + seal

You are wiring Innsigle into this repository. Innsigle stores all project state
under \`.innsigle/\` and does **not** detect or modify framework-specific publish
trees (\`static/\`, \`public/\`, \`docs/\`, \`_site/\`, etc.).

## Layout (source of truth)

\`\`\`text
.innsigle/
  config.json          # issuer id, key_id, key_url, op:// private key ref
  public/
    keys.json          # public issuer document
    claims/            # put *.attestation.json here when sealing pages
  provenance/          # transcript-derived L2 session data — stays local (gitignored)
  README.md
  AGENTS.md            # this file
\`\`\`

Private keys are **never** in the repo. Credentials come from 1Password via
\`config.json\` → \`onepassword.private_key_ref\`.

## Required build step

Before or as part of deploy, copy the public staging tree to the **site root**
well-known path (adjust only the left side if your tool needs a different
source path — the **destination path is fixed**):

\`\`\`bash
# Generic: after your site is rendered into SITE_ROOT
mkdir -p "$SITE_ROOT/.well-known/innsigle"
cp -a .innsigle/public/. "$SITE_ROOT/.well-known/innsigle/"
\`\`\`

Examples (illustrative only — pick what this repo uses):

| Tool | Typical SITE_ROOT / hook |
|------|---------------------------|
| Quarto | Copy into \`static/.well-known/innsigle/\` so render includes it, **or** post-copy into \`_site/.well-known/innsigle/\` |
| Hugo | \`static/.well-known/innsigle/\` |
| plain static | project \`public/\` or deploy rsync source |
| GitHub Pages (Actions) | step after build: copy into artifact root |

**Do not** invent alternate URL paths. Signed claims use:

- \`key_url\`: \`${keyUrl}\`
- site path: \`/.well-known/innsigle/keys.json\`

If the public host differs, update \`.innsigle/config.json\` \`issuer.key_url\`
**before** signing new claims (old seals keep their frozen URL).

## Seal a content file

Finalize the **exact bytes** you will publish, then:

\`\`\`bash
innsigle seal path/to/page.html
# optional: --kind model-primary|human-authored|mixed
# or commit a default colophon at .innsigle/colo.json

innsigle verify path/to/page.html
# finds attestation + keys under .innsigle/ (or public/.well-known/)
\`\`\`

Colophons MAY carry the optional \`human_input\` measure (integer percent,
method hi1, declared from the operator's session journal — proposed
automatically by \`innsigle seal <file> --auto\`). NEVER edit its component
counts to reach a target percent: the CLI recomputes the headline from the
counts and refuses mismatches (exit 5). No journal evidence → omit the object
entirely. Shape reference: \`innsigle colo example --kind model-primary --human-input\`.

Issuer metadata and the private key ref come from \`.innsigle/config.json\` +
1Password. Attestation lands in \`.innsigle/public/claims/\` — include that tree
in the publish copy step.

## 1Password bridging (env)

- \`INNSIGLE_OP_BIN\` may contain arguments, e.g. \`INNSIGLE_OP_BIN="mac op"\`
  to bridge to the host CLI from a VM (OrbStack).
- \`OP_ACCOUNT=<account>\` (or \`innsigle seal --op-account <account>\`) selects
  the 1Password account; it is passed as \`--account\` to \`op read\`.

## Identity (this repo)

- issuer_id: \`${issuerId}\`
- key_id: \`${keyId}\`
- key_url: \`${keyUrl}\`

## Non-goals for agents

- Do not commit PEM private keys or \`op\` session tokens.
- Do not re-run \`innsigle init\` unless the operator asked (creates a new key).
- Do not rewrite Innsigle crypto or move keys outside \`.innsigle/\` + 1Password.
`;
}

function arg(args, name) {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  return args[i + 1];
}
