import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
  appendFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "src/cli.mjs");
const integration = join(root, "integrations/quarto");

function quartoAvailable() {
  const r = spawnSync("quarto", ["--version"], { encoding: "utf8" });
  return r.status === 0;
}

// Quarto skips project inputs under any hidden path segment ("/."), so a
// TMPDIR under e.g. ~/.cache silently renders zero files. Fall back to /tmp.
function quartoSafeTmpBase() {
  const base = tmpdir();
  if (!`${base}/`.includes("/.")) return base;
  return "/tmp";
}

describe("Quarto × Innsigle workflow (e2e)", () => {
  it("filter renders colophon for a sealed page; stale digest suppresses it", (t) => {
    if (!quartoAvailable()) {
      t.skip("quarto not installed");
      return;
    }

    const proj = mkdtempSync(join(quartoSafeTmpBase(), "innsigle-quarto-test-"));
    const env = {
      ...process.env,
      INNSIGLE_CONFIG_HOME: join(proj, ".xdg"), // hermetic user config
    };

    function run(cmd, args, opts = {}) {
      return spawnSync(cmd, args, { encoding: "utf8", cwd: proj, env, ...opts });
    }
    function innsigle(args) {
      return run(process.execPath, [cli, ...args]);
    }

    // --- scaffold a tiny Quarto website wired to the vendored integration
    writeFileSync(
      join(proj, "_quarto.yml"),
      [
        "project:",
        "  type: website",
        "  output-dir: _site",
        "  post-render:",
        "    - ./publish-innsigle",
        "",
        "website:",
        '  title: "Innsigle Quarto Test"',
        "",
        "filters:",
        "  - innsigle.lua",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(proj, "index.qmd"),
      ["---", 'title: "Hello"', "---", "", "Sealed by innsigle.", ""].join("\n"),
    );
    copyFileSync(join(integration, "innsigle.lua"), join(proj, "innsigle.lua"));
    copyFileSync(join(integration, "publish-innsigle"), join(proj, "publish-innsigle"));
    chmodSync(join(proj, "publish-innsigle"), 0o755);

    // --- throwaway key + issuer document + repo config
    const keyDir = join(proj, ".keys");
    let r = innsigle(["keygen", "--out-dir", keyDir]);
    assert.equal(r.status, 0, r.stderr);
    const keyId = readFileSync(join(keyDir, "key-id.txt"), "utf8").trim();
    const pubRaw = readFileSync(join(keyDir, "ed25519.pub.raw.b64url"), "utf8").trim();

    mkdirSync(join(proj, ".innsigle/public/claims"), { recursive: true });
    r = innsigle([
      "keys",
      "template",
      "--issuer-id",
      "quarto-test",
      "--issuer-name",
      "Quarto Test",
      "--public-key",
      pubRaw,
      "--key-id",
      keyId,
      "--out",
      join(proj, ".innsigle/public/keys.json"),
    ]);
    assert.equal(r.status, 0, r.stderr);

    writeFileSync(
      join(proj, ".innsigle/config.json"),
      JSON.stringify(
        {
          innsigle_config: "1",
          issuer: {
            id: "quarto-test",
            name: "Quarto Test",
            key_id: keyId,
            key_url: "https://example.com/.well-known/innsigle/keys.json",
          },
        },
        null,
        2,
      ) + "\n",
    );

    // --- seal the page (subject URI path must equal /<project-relative path>)
    r = innsigle([
      "seal",
      "index.qmd",
      "--kind",
      "model-primary",
      "--uri",
      "https://example.com/index.qmd",
      "--key",
      join(keyDir, "ed25519.priv.pem"),
    ]);
    assert.equal(r.status, 0, r.stderr);
    const claims = readdirSync(join(proj, ".innsigle/public/claims")).filter((n) =>
      n.endsWith(".attestation.json"),
    );
    assert.equal(claims.length, 1, `expected one attestation, got ${claims}`);

    // --- render: colophon footer present, public tree published
    r = run("quarto", ["render"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    let html = readFileSync(join(proj, "_site/index.html"), "utf8");
    assert.match(html, /innsigle-colophon/);
    assert.match(html, /model-primary/);
    assert.match(html, /Quarto Test/);
    assert.ok(existsSync(join(proj, "_site/.well-known/innsigle/keys.json")));
    assert.ok(
      existsSync(join(proj, "_site/.well-known/innsigle/claims", claims[0])),
    );

    // --- canonical slug filename (PLAN-001 A1) is honored too
    const slugName = "index-qmd.attestation.json";
    renameSync(
      join(proj, ".innsigle/public/claims", claims[0]),
      join(proj, ".innsigle/public/claims", slugName),
    );
    r = run("quarto", ["render"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    html = readFileSync(join(proj, "_site/index.html"), "utf8");
    assert.match(html, /innsigle-colophon/);
    assert.match(html, new RegExp(`claims/${slugName}`));

    // --- edit source without re-sealing: warning, no footer
    appendFileSync(join(proj, "index.qmd"), "\nEdited after sealing.\n");
    r = run("quarto", ["render"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /no colophon rendered/);
    assert.match(r.stderr, /re-run `innsigle seal`/);
    html = readFileSync(join(proj, "_site/index.html"), "utf8");
    assert.doesNotMatch(html, /innsigle-colophon/);

    rmSync(proj, { recursive: true, force: true });
  });
});
