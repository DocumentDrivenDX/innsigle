import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { kindFromFrontmatter, contentRelToPath } from "../src/site-pages.mjs";
import { attestationSlug } from "../src/config.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "src/cli.mjs");
const fakeOp = join(root, "tests/fixtures/fake-op.mjs");

function run(args, opts = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    ...opts,
  });
}

function setupRepo() {
  const repo = mkdtempSync(join(tmpdir(), "innsigle-seal-all-"));
  const store = join(repo, "op-store");
  mkdirSync(store, { recursive: true });
  const wrapper = join(repo, "op-wrapper");
  writeFileSync(
    wrapper,
    `#!/bin/sh\nexport INNSIGLE_FAKE_OP_STORE="${store}"\nexec "${process.execPath}" "${fakeOp}" "$@"\n`,
  );
  chmodSync(wrapper, 0o755);
  const env = { ...process.env, INNSIGLE_OP_BIN: wrapper };
  delete env.OP_ACCOUNT;
  const r = run(
    [
      "init",
      "--onepassword",
      "--dir",
      repo,
      "--site-url",
      "https://docs.example/site",
      "--issuer-id",
      "docs-house",
      "--content-root",
      "content",
    ],
    { env },
  );
  assert.equal(r.status, 0, r.stderr);
  const cfgPath = join(repo, ".innsigle/config.json");
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  assert.equal(cfg.content_root, "content");
  assert.deepEqual(cfg.content_globs, ["content/**/*.md"]);
  const buildDir = join(repo, ".innsigle/keys/build");
  const kg = run(["keygen", "--out-dir", buildDir], { env });
  assert.equal(kg.status, 0, kg.stderr);
  const buildId = readFileSync(join(buildDir, "key-id.txt"), "utf8").trim();
  const buildPub = readFileSync(join(buildDir, "ed25519.pub.raw.b64url"), "utf8").trim();
  cfg.keys = {
    human: { key_id: cfg.issuer.key_id, role: "human" },
    build: {
      key_id: buildId,
      role: "build",
      signing_key: ".innsigle/keys/build/ed25519.priv.pem",
    },
  };
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  const keysPath = join(repo, ".innsigle/public/keys.json");
  const keysDoc = JSON.parse(readFileSync(keysPath, "utf8"));
  keysDoc.keys[0].role = "human";
  keysDoc.keys.push({
    key_id: buildId,
    alg: "ed25519",
    public_key: buildPub,
    created_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    revoked_at: null,
    role: "build",
  });
  writeFileSync(keysPath, JSON.stringify(keysDoc, null, 2) + "\n");
  return { repo, env, cfgPath, buildId };
}

describe("kindFromFrontmatter + content paths", () => {
  it("generated: true is model-primary, else mixed", () => {
    assert.equal(kindFromFrontmatter("---\ngenerated: true\n---\n# Hi\n"), "model-primary");
    assert.equal(kindFromFrontmatter("---\ntitle: Hand\n---\n# Hi\n"), "mixed");
    assert.equal(kindFromFrontmatter("# no fm\n"), "mixed");
  });

  it("maps curated/generated rels to site paths", () => {
    assert.equal(contentRelToPath("curated/index.md"), "/");
    assert.equal(contentRelToPath("curated/use/cli.md"), "/use/cli/");
    assert.equal(contentRelToPath("generated/glossary.md"), "/reference/glossary/");
    assert.equal(contentRelToPath("generated/artifacts/prd.md"), "/reference/artifacts/prd/");
  });

  it("content_root slugs drop the prefix (Helix)", () => {
    const repo = "/repo";
    const file = "/repo/docs/website/content/why/_index.md";
    assert.equal(
      attestationSlug(repo, file, { contentRoot: "docs/website/content" }),
      "why-index-md",
    );
    assert.equal(attestationSlug(repo, file), "docs-website-content-why-index-md");
  });
});

describe("innsigle seal --all + publish (Helix pattern)", () => {
  it("seals globs with frontmatter kinds, skips up-to-date, publishes well-known", () => {
    const { repo, env } = setupRepo();
    mkdirSync(join(repo, "content/why"), { recursive: true });
    writeFileSync(
      join(repo, "content/why/index.md"),
      "---\ntitle: Why\n---\n# Why\nHand mixed.\n",
    );
    writeFileSync(
      join(repo, "content/ref.md"),
      "---\ntitle: Ref\ngenerated: true\n---\n# Ref\nGenerated.\n",
    );
    writeFileSync(join(repo, "other.md"), "# not in glob\n");

    let r = run(["seal", "--all"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /sealed \(mixed\/human\): content\/why\/index\.md/);
    assert.match(r.stderr, /sealed \(model-primary\/build\): content\/ref\.md/);
    assert.doesNotMatch(r.stderr, /other\.md/);

    const claims = join(repo, ".innsigle/public/claims");
    assert.ok(existsSync(join(claims, "why-index-md.attestation.json")));
    assert.ok(existsSync(join(claims, "ref-md.attestation.json")));
    const mixed = JSON.parse(readFileSync(join(claims, "why-index-md.attestation.json"), "utf8"));
    assert.equal(mixed.payload.colophon.composition, "mixed");
    assert.match(mixed.payload.subjects[0].uri, /https:\/\/docs\.example\/site\//);

    r = run(["seal", "--all"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /0 sealed, 2 up to date/);

    r = run(["verify", "--all"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr + r.stdout);

    r = run(["publish", "public"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(repo, "public/.well-known/innsigle/keys.json")));
    assert.ok(
      existsSync(join(repo, "public/.well-known/innsigle/claims/why-index-md.attestation.json")),
    );

    rmSync(repo, { recursive: true, force: true });
  });

  it("seal --all removes ORPHAN claims", () => {
    const { repo, env } = setupRepo();
    mkdirSync(join(repo, "content"), { recursive: true });
    writeFileSync(join(repo, "content/a.md"), "---\ntitle: A\n---\n# A\n");
    writeFileSync(join(repo, "content/gone.md"), "---\ntitle: G\n---\n# G\n");
    let r = run(["seal", "--all"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    rmSync(join(repo, "content/gone.md"));
    r = run(["seal", "--all"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /removed orphan claim: gone-md\.attestation\.json/);
    assert.equal(
      existsSync(join(repo, ".innsigle/public/claims/gone-md.attestation.json")),
      false,
    );
    rmSync(repo, { recursive: true, force: true });
  });

  it("human key endorses build key; generated claims use the build key_id", () => {
    const { repo, env, buildId } = setupRepo();
    mkdirSync(join(repo, "content"), { recursive: true });
    writeFileSync(join(repo, "content/a.md"), "---\ntitle: A\n---\n# A\n");
    writeFileSync(
      join(repo, "content/g.md"),
      "---\ntitle: G\ngenerated: true\n---\n# G\n",
    );
    let r = run(
      ["endorse", "--subject-key-id", buildId, "--purpose", "build-signing"],
      { cwd: repo, env },
    );
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /ok: endorsed/);
    const keysDoc = JSON.parse(
      readFileSync(join(repo, ".innsigle/public/keys.json"), "utf8"),
    );
    assert.equal(keysDoc.endorsements.length, 1);
    assert.equal(keysDoc.endorsements[0].subject_key_id, buildId);

    r = run(["seal", "--all"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr);
    const mixed = JSON.parse(
      readFileSync(join(repo, ".innsigle/public/claims/a-md.attestation.json"), "utf8"),
    );
    const gen = JSON.parse(
      readFileSync(join(repo, ".innsigle/public/claims/g-md.attestation.json"), "utf8"),
    );
    assert.notEqual(mixed.payload.issuer.key_id, buildId);
    assert.equal(gen.payload.issuer.key_id, buildId);
    r = run(["verify", "--all"], { cwd: repo, env });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    rmSync(repo, { recursive: true, force: true });
  });
});
