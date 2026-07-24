import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
const BASE = "/innsigle";

const CORE_LEAVES = [
  "/",
  "/why/",
  "/use/",
  "/use/cli/",
  "/use/colophon/",
  "/use/verify/",
  "/use/marks/",
  "/use/walkthrough-docs/",
  "/use/walkthrough-social/",
  "/reference/",
  "/reference/artifacts/",
  "/reference/glossary/",
  "/non-goals/",
  "/sample/",
];

function urlToFile(urlPath) {
  let rel = urlPath.startsWith(BASE) ? urlPath.slice(BASE.length) : urlPath;
  if (!rel || rel === "/") return join(site, "index.html");
  return join(site, rel.replace(/^\//, "").replace(/\/$/, ""), "index.html");
}

function walkHtml(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkHtml(p, acc);
    else if (name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

describe("site build (product-microsite-ia)", () => {
  before(() => {
    const r = spawnSync(process.execPath, [join(root, "scripts/build-site.mjs")], {
      env: { ...process.env, SITE_BASE: BASE },
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
  });

  it("emits all core leaves from ia.yml", () => {
    for (const leaf of CORE_LEAVES) {
      const file = urlToFile(`${BASE}${leaf === "/" ? "/" : leaf}`);
      // leaf already includes slashes; BASE+/why/ → file site/why/index.html
      const f =
        leaf === "/"
          ? join(site, "index.html")
          : join(site, leaf.replace(/^\//, "").replace(/\/$/, ""), "index.html");
      assert.ok(existsSync(f), `missing core leaf ${leaf} → ${f}`);
    }
  });

  it("home and why have active nav state", () => {
    const home = readFileSync(join(site, "index.html"), "utf8");
    assert.match(home, /aria-current="page"/);
    const why = readFileSync(join(site, "why/index.html"), "utf8");
    assert.match(why, /aria-current="page"/);
  });

  it("generated artifact pages carry generation banner", () => {
    const prd = readFileSync(join(site, "reference/artifacts/prd/index.html"), "utf8");
    assert.match(prd, /Generated reference/);
    assert.match(prd, /docs\/helix/);
  });

  it("internal /innsigle/ links resolve to existing files", () => {
    const htmlFiles = walkHtml(site);
    const missing = [];
    const hrefRe = /href="(\/innsigle\/[^"#?]*)"/g;
    for (const file of htmlFiles) {
      const html = readFileSync(file, "utf8");
      let m;
      while ((m = hrefRe.exec(html))) {
        let path = m[1];
        if (path.endsWith("/")) {
          const f = join(site, path.slice(BASE.length).replace(/^\//, ""), "index.html");
          // path /innsigle/why/ → site/why/index.html
          const rel = path.slice(`${BASE}/`.length);
          const target = join(site, rel, "index.html");
          if (!existsSync(target) && path !== `${BASE}/`) {
            // also allow file without trailing semantics
            const alt = join(site, rel.replace(/\/$/, "") + ".html");
            if (!existsSync(alt)) missing.push(`${file} → ${path}`);
          }
        } else if (path.includes("/assets/") || path.endsWith(".svg") || path.endsWith(".css")) {
          const rel = path.slice(`${BASE}/`.length);
          const target = join(site, rel);
          if (!existsSync(target)) missing.push(`${file} → ${path}`);
        }
      }
    }
    // filter false positives for /innsigle/ alone
    const real = missing.filter((x) => !x.endsWith("→ /innsigle/"));
    assert.equal(real.length, 0, real.slice(0, 20).join("\n"));
  });
});
