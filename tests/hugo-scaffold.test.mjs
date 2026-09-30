import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  detectThemeHook,
  findHugoConfig,
  hasMounts,
  mountsYaml,
  packagedHugoDir,
  scaffoldHugo,
} from "../src/hugo.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "src/cli.mjs");
const fakeOp = join(root, "tests/fixtures/fake-op.mjs");

function hugoSite({ theme = "PaperMod", config = "hugo.yaml" } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "innsigle-hugo-scaffold-"));
  mkdirSync(join(dir, "content"), { recursive: true });
  if (theme) mkdirSync(join(dir, "themes", theme), { recursive: true });
  const themeLine = theme ? `theme: ${theme}\n` : "";
  writeFileSync(join(dir, config), `baseURL: https://example.test/\ntitle: T\n${themeLine}`);
  return dir;
}

describe("hugo scaffolding", () => {
  it("ships the partials and CSS in the package", () => {
    const pkg = packagedHugoDir();
    assert.ok(pkg, "integrations/hugo must be present");
    for (const f of [
      "layouts/_partials/innsigle-colophon.html",
      "layouts/_partials/innsigle-badge.html",
      "layouts/_partials/innsigle-glyph.html",
      "assets/css/innsigle.css",
      "README.md",
    ]) {
      assert.ok(existsSync(join(pkg, f)), `packaged ${f}`);
    }
  });

  it("the mounts block restates Hugo's defaults", () => {
    const y = mountsYaml("content");
    // Declaring any mount replaces all defaults; omitting these breaks the site.
    for (const target of ["target: content", "target: assets", "target: layouts", "target: static"]) {
      assert.match(y, new RegExp(target));
    }
    for (const target of [
      "static/.well-known/innsigle",
      "assets/innsigle",
      "assets/content-src",
    ]) {
      assert.match(y, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });

  it("uses the configured content root in both content mounts", () => {
    const y = mountsYaml("site/content");
    assert.match(y, /source: site\/content\n      target: content/);
    assert.match(y, /source: site\/content\n      target: assets\/content-src/);
  });

  it("finds the config and detects a known theme", () => {
    const dir = hugoSite();
    const cfg = findHugoConfig(dir);
    assert.equal(cfg, join(dir, "hugo.yaml"));
    const theme = detectThemeHook(dir, cfg);
    assert.equal(theme.hook, "layouts/partials/comments.html");
    assert.match(theme.note, /params\.comments/);
    rmSync(dir, { recursive: true, force: true });
  });

  it("reports no theme hook for an unknown theme", () => {
    const dir = hugoSite({ theme: "SomeTheme" });
    assert.equal(detectThemeHook(dir, findHugoConfig(dir)), null);
    rmSync(dir, { recursive: true, force: true });
  });

  it("detects existing mounts and refuses to append over them", () => {
    const dir = hugoSite();
    const cfg = join(dir, "hugo.yaml");
    writeFileSync(cfg, `${readFileSync(cfg, "utf8")}module:\n  mounts:\n    - source: content\n      target: content\n`);
    assert.equal(hasMounts(cfg), true);
    const { manual, wrote } = scaffoldHugo({ siteDir: dir });
    assert.ok(!wrote.some((w) => w.includes("module.mounts appended")), "must not append");
    assert.ok(manual.some((m) => m.includes("already declares some")), manual.join("|"));
    rmSync(dir, { recursive: true, force: true });
  });

  it("scaffolds a PaperMod site and appends mounts once", () => {
    const dir = hugoSite();
    const first = scaffoldHugo({ siteDir: dir });
    assert.ok(existsSync(join(dir, "layouts/partials/innsigle-colophon.html")));
    assert.ok(existsSync(join(dir, "layouts/partials/innsigle-badge.html")));
    assert.ok(existsSync(join(dir, "assets/css/innsigle.css")));
    assert.ok(existsSync(join(dir, "static/.gitkeep")), "static/ created for the mount");
    assert.ok(existsSync(join(dir, "layouts/partials/comments.html")), "theme adapter");
    assert.ok(first.manual.some((m) => m.includes("params.comments")));

    // idempotent: a second run must not duplicate the mounts block
    scaffoldHugo({ siteDir: dir });
    const text = readFileSync(join(dir, "hugo.yaml"), "utf8");
    assert.equal(text.match(/target: assets\/content-src/g).length, 1, "mounts appended twice");
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("innsigle doctor --hugo", () => {
  it("fails a site with no .innsigle, passes a scaffolded and sealed one", () => {
    const dir = hugoSite();

    let r = spawnSync(process.execPath, [cli, "doctor", "--hugo", dir], { encoding: "utf8" });
    assert.equal(r.status, 1, "bare site should fail");

    const store = join(dir, "op-store");
    mkdirSync(store, { recursive: true });
    const wrapper = join(dir, "op-wrapper");
    writeFileSync(
      wrapper,
      `#!/bin/sh\nexport INNSIGLE_FAKE_OP_STORE="${store}"\nexec "${process.execPath}" "${fakeOp}" "$@"\n`,
    );
    chmodSync(wrapper, 0o755);
    const env = { ...process.env, INNSIGLE_OP_BIN: wrapper };
    delete env.OP_ACCOUNT;

    writeFileSync(
      join(dir, "content/post.md"),
      "---\ntitle: P\ncomposition: model-primary\n---\nbody\n",
    );

    r = spawnSync(
      process.execPath,
      [cli, "init", "--onepassword", "--hugo", "--dir", dir,
       "--site-url", "https://example.test", "--issuer-id", "demo",
       "--content-root", "content"],
      { encoding: "utf8", env },
    );
    assert.equal(r.status, 0, r.stderr);
    // --hugo must choose the field mode, or the badge and the seal disagree
    const cfg = JSON.parse(readFileSync(join(dir, ".innsigle/config.json"), "utf8"));
    assert.deepEqual(cfg.kind_from_frontmatter, { field: "composition" });

    r = spawnSync(process.execPath, [cli, "seal", "--all"], { cwd: dir, encoding: "utf8", env });
    assert.equal(r.status, 0, r.stderr);

    r = spawnSync(process.execPath, [cli, "doctor", "--hugo", dir], { encoding: "utf8", env });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /ok {4}mount assets\/content-src/);
    assert.match(r.stdout, /agrees with every seal/);
    assert.match(r.stdout, /0 failing/);
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when an unknown theme leaves nothing calling the partial", () => {
    // No adapter is written for a theme we do not know, so the partial is
    // installed but unreachable — a site that looks wired and renders no seals.
    const dir = hugoSite({ theme: "SomeTheme" });
    const store = join(dir, "op-store");
    mkdirSync(store, { recursive: true });
    const wrapper = join(dir, "op-wrapper");
    writeFileSync(
      wrapper,
      `#!/bin/sh\nexport INNSIGLE_FAKE_OP_STORE="${store}"\nexec "${process.execPath}" "${fakeOp}" "$@"\n`,
    );
    chmodSync(wrapper, 0o755);
    const env = { ...process.env, INNSIGLE_OP_BIN: wrapper };
    delete env.OP_ACCOUNT;

    const init = spawnSync(
      process.execPath,
      [cli, "init", "--onepassword", "--hugo", "--dir", dir,
       "--site-url", "https://example.test", "--issuer-id", "demo",
       "--content-root", "content"],
      { encoding: "utf8", env },
    );
    assert.equal(init.status, 0, init.stderr);
    assert.match(init.stderr, /todo: call \{\{ partial/, "must tell the operator to wire it");

    const r = spawnSync(process.execPath, [cli, "doctor", "--hugo", dir], {
      encoding: "utf8",
      env,
    });
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, /nothing calls the partial/);
    rmSync(dir, { recursive: true, force: true });
  });
});
