import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  chmodSync,
  mkdtempSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "src/cli.mjs");
const fakeOp = join(root, "tests/fixtures/fake-op.mjs");

function run(args, opts = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    ...opts,
  });
}

describe("innsigle init --onepassword", () => {
  it("writes only under .innsigle/ plus 1Password item", () => {
    const repo = mkdtempSync(join(tmpdir(), "innsigle-init-"));
    const store = join(repo, "op-store");
    mkdirSync(store, { recursive: true });

    const wrapper = join(repo, "op-wrapper");
    writeFileSync(
      wrapper,
      `#!/bin/sh\nexport INNSIGLE_FAKE_OP_STORE="${store}"\nexec "${process.execPath}" "${fakeOp}" "$@"\n`,
    );
    chmodSync(wrapper, 0o755);
    const env = { ...process.env, INNSIGLE_OP_BIN: wrapper };

    const r = run(
      [
        "init",
        "--onepassword",
        "--dir",
        repo,
        "--site-url",
        "https://blog.example.com",
        "--issuer-id",
        "demo-blog",
        "--issuer-name",
        "Demo Blog",
        "--vault",
        "Private",
      ],
      { env },
    );
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /key_id=ed25519:/);
    assert.match(r.stderr, /onepassword=op:\/\//);
    assert.match(r.stderr, /\.innsigle\/AGENTS\.md/);

    // No framework web-root probing
    assert.equal(existsSync(join(repo, "static")), false);
    assert.equal(existsSync(join(repo, "innsigle.json")), false);

    const cfg = JSON.parse(readFileSync(join(repo, ".innsigle/config.json"), "utf8"));
    assert.equal(cfg.schema_version, "1");
    assert.equal(cfg.issuer.id, "demo-blog");
    assert.equal(cfg.issuer.name, "Demo Blog");
    assert.match(cfg.issuer.key_id, /^ed25519:[0-9a-f]{32}$/);
    assert.equal(
      cfg.issuer.key_url,
      "https://blog.example.com/.well-known/innsigle/keys.json",
    );
    assert.equal(cfg.paths.keys, ".innsigle/public/keys.json");
    assert.equal(cfg.paths.public, ".innsigle/public");
    assert.equal(cfg.publish.copy.from, ".innsigle/public");
    assert.equal(cfg.publish.copy.to, ".well-known/innsigle");
    assert.ok(cfg.onepassword.private_key_ref.startsWith("op://Private/"));
    assert.ok(cfg.onepassword.item_id);

    const keys = JSON.parse(readFileSync(join(repo, ".innsigle/public/keys.json"), "utf8"));
    assert.equal(keys.innsigle_issuer, "1");
    assert.equal(keys.keys[0].key_id, cfg.issuer.key_id);
    assert.ok(existsSync(join(repo, ".innsigle/public/claims")));
    assert.ok(existsSync(join(repo, ".innsigle/README.md")));
    assert.ok(existsSync(join(repo, ".innsigle/AGENTS.md")));
    const agents = readFileSync(join(repo, ".innsigle/AGENTS.md"), "utf8");
    assert.match(agents, /\.innsigle\/public/);
    assert.match(agents, /\.well-known\/innsigle/);

    writeFileSync(join(repo, "page.html"), "<html>sealed</html>\n");

    let c = run(["seal", "page.html", "--kind", "human-authored"], {
      cwd: repo,
      env,
    });
    assert.equal(c.status, 0, c.stderr);
    assert.match(c.stderr, /ok: sealed/);
    // Canonical slug naming (PLAN-001 A1): project-relative path slug
    assert.ok(
      existsSync(join(repo, ".innsigle/public/claims/page-html.attestation.json")),
    );
    // Debug sidecars gitignored (PLAN-001 A4)
    assert.match(readFileSync(join(repo, ".innsigle/.gitignore"), "utf8"), /^debug\/$/m);
    // Transcript-derived provenance data stays local too (F8)
    assert.match(
      readFileSync(join(repo, ".innsigle/.gitignore"), "utf8"),
      /^provenance\/$/m,
    );
    assert.match(readFileSync(join(repo, ".innsigle/README.md"), "utf8"), /provenance\//);
    assert.match(readFileSync(join(repo, ".innsigle/AGENTS.md"), "utf8"), /provenance\//);

    c = run(["verify", "page.html"], { cwd: repo, env });
    assert.equal(c.status, 0, c.stderr + c.stdout);
    assert.match(c.stdout, /VALID/);

    rmSync(repo, { recursive: true, force: true });
  });

  it("refuses init without --onepassword", () => {
    const r = run(["init"]);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--onepassword/);
  });
});
