import { test, expect, type Page } from "@playwright/test";

/** Core leaves from docs/website/ia.yml (local SITE_BASE empty → root paths). */
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

async function collectSameOriginHrefs(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const origin = location.origin;
    const hrefs = new Set<string>();
    for (const a of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      try {
        const u = new URL(a.href, location.href);
        if (u.origin !== origin) continue;
        if (u.protocol === "mailto:" || u.protocol === "tel:") continue;
        // Drop hash-only for navigation checks; still hit path
        hrefs.add(u.pathname.endsWith("/") || u.pathname.includes(".") ? u.pathname : u.pathname + "/");
      } catch {
        /* ignore */
      }
    }
    return [...hrefs].sort();
  });
}

test.describe("Link integrity", () => {
  test("core IA leaves return 200 and render main content", async ({ page }) => {
    for (const path of CORE_LEAVES) {
      await test.step(`GET ${path}`, async () => {
        const res = await page.goto(path, { waitUntil: "domcontentloaded" });
        expect(res, `no response for ${path}`).not.toBeNull();
        expect(res!.status(), `${path} status`).toBeLessThan(400);
        // Text is not invisible / zero-size
        const main = page.locator("main").first();
        await expect(main).toBeVisible();
        const box = await main.boundingBox();
        expect(box, `${path} main bounding box`).not.toBeNull();
        expect(box!.width).toBeGreaterThan(120);
        expect(box!.height).toBeGreaterThan(40);
        const text = (await main.innerText()).trim();
        expect(text.length, `${path} has readable text`).toBeGreaterThan(20);
      });
    }
  });

  test("crawl internal links from core leaves (no broken same-origin hrefs)", async ({
    page,
    request,
  }) => {
    const seen = new Set<string>();
    const broken: string[] = [];
    const queue = [...CORE_LEAVES];

    while (queue.length) {
      const path = queue.shift()!;
      if (seen.has(path)) continue;
      seen.add(path);

      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      if (!res || res.status() >= 400) {
        broken.push(`${path} (status ${res?.status() ?? "null"})`);
        continue;
      }

      const hrefs = await collectSameOriginHrefs(page);
      for (const href of hrefs) {
        // Skip pure asset download noise later; still verify existence
        if (href.match(/\.(svg|png|jpg|css|js|json|ico)$/i)) {
          const assetRes = await request.get(href);
          if (!assetRes.ok()) broken.push(`${path} → asset ${href} (${assetRes.status()})`);
          continue;
        }
        const normalized = href.endsWith("/") || href.includes(".") ? href : href + "/";
        if (!seen.has(normalized) && !seen.has(href)) {
          // BFS one hop from core for HTML pages
          if (href.startsWith("/reference/") || href.startsWith("/use/") || href.startsWith("/why/") || href === "/" || href.startsWith("/sample") || href.startsWith("/non-goals")) {
            queue.push(href.endsWith("/") || href.includes(".") ? href : href + "/");
          }
        }
        const head = await request.get(href);
        if (!head.ok()) {
          broken.push(`${path} → ${href} (${head.status()})`);
        }
      }
    }

    expect(broken, `broken links:\n${broken.join("\n")}`).toEqual([]);
    expect(seen.size).toBeGreaterThan(CORE_LEAVES.length - 1);
  });

  test("primary nav aria-current is set on Why and Use", async ({ page }) => {
    await page.goto("/why/");
    const whyNav = page.locator('nav[aria-label="Primary"] a', { hasText: "Why" });
    await expect(whyNav).toHaveAttribute("aria-current", "page");

    await page.goto("/use/");
    const useNav = page.locator('nav[aria-label="Primary"] a', { hasText: "Use" });
    await expect(useNav).toHaveAttribute("aria-current", "page");
  });

  test("generated artifact index groups activities", async ({ page }) => {
    await page.goto("/reference/artifacts/");
    await expect(page.getByRole("heading", { name: /Artifacts/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Discover$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Frame$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Design$/i })).toBeVisible();
    await expect(page.getByText(/Generated from the project's HELIX tree/i)).toBeVisible();
  });
});
