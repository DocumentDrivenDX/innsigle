import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const workflow = join(root, "scripts/hugo-innsigle-workflow.mjs");

function hugoAvailable() {
  const r = spawnSync("hugo", ["version"], { encoding: "utf8" });
  return r.status === 0;
}

describe("Hugo × Innsigle workflow (e2e)", () => {
  it("bootstraps Hugo, init, publish wire, seal, VALID", (t) => {
    if (!hugoAvailable()) {
      t.skip("hugo not installed");
      return;
    }

    const out = mkdtempSync(join(tmpdir(), "innsigle-hugo-test-"));
    const r = spawnSync(process.execPath, [workflow, "--out-dir", out, "--keep"], {
      encoding: "utf8",
      cwd: root,
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /summary=/);
    assert.match(r.stderr, /VALID/);

    assert.ok(existsSync(join(out, ".innsigle/config.json")));
    assert.ok(existsSync(join(out, ".innsigle/AGENTS.md")));
    assert.ok(existsSync(join(out, ".innsigle/public/keys.json")));
    assert.ok(existsSync(join(out, "static/.well-known/innsigle/keys.json")));
    assert.ok(existsSync(join(out, "public/index.html")));
    assert.ok(
      existsSync(join(out, "public/.well-known/innsigle/claims/index.attestation.json")),
    );

    const agents = readFileSync(join(out, ".innsigle/AGENTS.md"), "utf8");
    assert.match(agents, /\.innsigle\/public/);
    assert.match(agents, /\.well-known\/innsigle/);

    const line = r.stdout
      .split("\n")
      .map((s) => s.trim())
      .find((s) => s.startsWith("summary="));
    const summary = JSON.parse(line.slice("summary=".length));
    assert.equal(summary.ok, true);
    assert.match(summary.key_id, /^ed25519:/);

    rmSync(out, { recursive: true, force: true });
  });
});
