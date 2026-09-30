#!/usr/bin/env node
/**
 * Minimal 1Password CLI stub for innsigle init / sign tests.
 * Honors INNSIGLE_FAKE_OP_STORE (dir) for create/read of private keys.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const store = process.env.INNSIGLE_FAKE_OP_STORE || "/tmp/innsigle-fake-op";
const argv = process.argv.slice(2);

function die(msg, code = 1) {
  process.stderr.write(msg + "\n");
  process.exit(code);
}

if (argv[0] === "--version") {
  process.stdout.write("2.0.0-fake\n");
  process.exit(0);
}

if (argv[0] === "vault" && argv[1] === "list") {
  // innsigle probes authorization with `vault list`, not `whoami`:
  // under desktop-app integration `whoami` reports "not signed in" even
  // when reads and writes succeed.
  process.stdout.write(
    JSON.stringify([{ id: "vault-1", name: "Private" }]) + "\n",
  );
  process.exit(0);
}

if (argv[0] === "whoami") {
  process.stdout.write(JSON.stringify({ email: "test@example.com" }) + "\n");
  process.exit(0);
}

if (argv[0] === "item" && argv[1] === "create") {
  const ti = argv.indexOf("--template");
  if (ti === -1) die("fake-op: missing --template");
  const templatePath = argv[ti + 1];
  const template = JSON.parse(readFileSync(templatePath, "utf8"));
  const vaultFlag = argv.indexOf("--vault");
  const vaultName = vaultFlag !== -1 ? argv[vaultFlag + 1] : "Private";
  const acctFlag = argv.indexOf("--account");
  const account = acctFlag !== -1 ? argv[acctFlag + 1] : null;
  const priv = template.fields?.find((f) => f.label === "private key")?.value;
  if (!priv) die("fake-op: template missing private key field");
  mkdirSync(store, { recursive: true });
  const id = "fake-item-" + String(Math.random()).slice(2, 10);
  const item = {
    id,
    title: template.title,
    vault: { id: "vault-1", name: vaultName },
  };
  writeFileSync(join(store, id + ".pem"), priv);
  writeFileSync(
    join(store, "last.json"),
    JSON.stringify({ ...item, private_key: priv, account }),
  );
  // Map op:// refs for read. Real op resolves an item by title OR by uuid,
  // and innsigle prefers the uuid whenever the title is not reference-safe,
  // so register both forms.
  writeFileSync(join(store, "refs.json"), JSON.stringify({
    ...(existsSync(join(store, "refs.json"))
      ? JSON.parse(readFileSync(join(store, "refs.json"), "utf8"))
      : {}),
    [`${vaultName}/${template.title}/private key`]: id,
    [`${vaultName}/${id}/private key`]: id,
  }));
  process.stdout.write(JSON.stringify(item) + "\n");
  process.exit(0);
}

if (argv[0] === "read") {
  const ref = argv[1] || "";
  // op://Vault/Title/private key
  const m = ref.match(/^op:\/\/([^/]+)\/(.+)\/private key$/);
  if (!m) die("fake-op: unsupported ref " + ref);
  const refKey = `${m[1]}/${m[2]}/private key`;
  if (!existsSync(join(store, "refs.json"))) die("fake-op: no refs");
  const refs = JSON.parse(readFileSync(join(store, "refs.json"), "utf8"));
  const id = refs[refKey];
  if (!id || !existsSync(join(store, id + ".pem"))) die("fake-op: unknown ref");
  process.stdout.write(readFileSync(join(store, id + ".pem"), "utf8"));
  process.exit(0);
}

die("fake-op: unhandled " + argv.join(" "));
