/**
 * Install / bin smoke (FR-18: tooling ships documented and runnable).
 * Uses npm install from the local package into a temp project.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    encoding: "utf8",
    ...opts,
  });
}

describe("innsigle install surface", () => {
  it("package.json declares bin innsigle → src/cli.mjs", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.equal(pkg.bin?.innsigle, "./src/cli.mjs");
    assert.ok(existsSync(join(root, "src/cli.mjs")));
    const head = readFileSync(join(root, "src/cli.mjs"), "utf8").slice(0, 30);
    assert.match(head, /^#!/);
  });

  it("npm install from local path exposes working innsigle bin", () => {
    const t = mkdtempSync(join(tmpdir(), "innsigle-install-"));
    const proj = join(t, "app");
    mkdirSync(proj);
    writeFileSync(
      join(proj, "package.json"),
      JSON.stringify({ name: "innsigle-install-smoke", private: true, type: "module" }),
    );

    try {
      const install = run("npm", ["install", root], {
        cwd: proj,
        env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false" },
      });
      assert.equal(install.status, 0, install.stderr + install.stdout);

      const bin = join(proj, "node_modules", ".bin", "innsigle");
      assert.ok(existsSync(bin), "expected node_modules/.bin/innsigle");

      const help = run(bin, [], { cwd: proj });
      // Usage → exit 1 per CLI
      assert.equal(help.status, 1, help.stderr + help.stdout);
      const out = (help.stdout || "") + (help.stderr || "");
      assert.match(out, /innsigle/i);
      assert.match(out, /keygen/);
      assert.match(out, /verify/);

      const colo = run(bin, ["colo", "example", "--kind", "model-primary"], {
        cwd: proj,
      });
      assert.equal(colo.status, 0, colo.stderr + colo.stdout);
      const json = JSON.parse(colo.stdout);
      assert.equal(json.composition, "model-primary");
    } finally {
      rmSync(t, { recursive: true, force: true });
    }
  });

  it("README and CLI curated page document GitHub install", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    assert.match(readme, /npm install github:DocumentDrivenDX\/innsigle/);
    assert.match(readme, /## Install/);

    const cliPage = readFileSync(
      join(root, "docs/website/content/curated/use/cli.md"),
      "utf8",
    );
    assert.match(cliPage, /## Install/);
    assert.match(cliPage, /npm install github:DocumentDrivenDX\/innsigle/);
    assert.match(cliPage, /\binnsigle keygen\b/);
  });
});
