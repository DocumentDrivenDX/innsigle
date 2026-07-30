import { test, expect, type Page } from "@playwright/test";
import {
  BRAND,
  brandRe,
  includesA1Phrase,
} from "../scripts/brand-lines.mjs";

/**
 * Design-voice visual assessment (DESIGN.md + product-microsite-ia).
 * Brand strings from scripts/brand-lines.mjs only (no raw B4/SAMPLE literals).
 */

const SHOT_PAGES: { name: string; path: string; mustSee: (string | RegExp)[] }[] = [
  {
    name: "home",
    path: "/",
    mustSee: [BRAND.B4, /colophon|composition/i, /INN-siggle|Innsigle/i, /Check it|sample/i],
  },
  {
    name: "why",
    path: "/why/",
    mustSee: [/Why Innsigle/i, /gap|C2PA|Not By AI/i, /sample|check/i],
  },
  {
    name: "use",
    path: "/use/",
    mustSee: [/Use Innsigle/i, /Install|github:DocumentDrivenDX\/innsigle/i, /sample|sealed/i, /CLI/i],
  },
  {
    name: "cli",
    path: "/use/cli/",
    mustSee: [/Install/i, /github:DocumentDrivenDX\/innsigle|npm install/i, /Check it|VALID|keygen/i],
  },
  {
    name: "colophon",
    path: "/use/colophon/",
    mustSee: [/colophon/i, /model-primary|human-authored|mixed/i, /Edit is not origin/i],
  },
  {
    name: "issuer",
    path: "/use/issuer/",
    mustSee: [/Issuer/i, /key_url|absolute|HTTPS/i, /Check it|exit/i],
  },
  {
    name: "verify",
    path: "/use/verify/",
    mustSee: [/Verify/i, /VALID|signature|digest/i, /Check it|sample/i],
  },
  {
    name: "provenance",
    path: "/use/provenance/",
    mustSee: [/Session provenance|provenance/i, /model-primary/i, /Check it|test:provenance/i],
  },
  {
    name: "marks",
    path: "/use/marks/",
    mustSee: [/Marks/i, /Matrix|Brand|Cartouche|Ring/i, /human-authored|model-primary/i, /Check it|sample/i],
  },
  {
    name: "walkthrough-docs",
    path: "/use/walkthrough-docs/",
    mustSee: [/Walkthrough/i, /seal a docs page/i, /keygen|claim build|verify/i, /Check it|Sample/i],
  },
  {
    name: "artifacts",
    path: "/reference/artifacts/",
    mustSee: [/Artifacts/i, /Discover|Frame|Design/i],
  },
  {
    name: "prd-generated",
    path: "/reference/artifacts/prd/",
    mustSee: [/Product Requirements|PRD/i, /Generated reference|docs\/helix/i],
  },
  {
    name: "non-goals",
    path: "/non-goals/",
    mustSee: [/AI detector/i, /C2PA replacement/i, brandRe(BRAND.A1, "i")],
  },
  {
    name: "sample",
    path: "/sample/",
    mustSee: [/sample|model-primary|Innsigle|Sealed sample/i, brandRe(BRAND.SAMPLE_CUE)],
  },
  {
    name: "walkthrough-provenance",
    path: "/use/walkthrough-provenance/",
    mustSee: [/conversation|colophon/i, /Human prompts|You/i, /Sealed Notes|model-primary/i],
  },
  {
    name: "walkthrough-hugo",
    path: "/use/walkthrough-hugo/",
    mustSee: [
      /Hugo/i,
      /\.innsigle/i,
      /init --onepassword|VALID|well-known/i,
      /Check it|workflow/i,
    ],
  },
];

/**
 * Soft design-voice anti-patterns (promoting detection / purity theater).
 * Category boundaries live on Non-goals; product chrome should not pitch
 * "not a detector". Negated educational copy in body text is fine.
 */
const FORBIDDEN_VOICE = [
  /verified authentic content/i,
  /AI detection score/i,
  /detector accuracy/i,
  /\bdetects AI content\b/i,
  /(?:offers|shows|includes|displays)\s+(?:a\s+)?purity score/i,
  /(?:guarantees|proves)\s+(?:the\s+)?content is (?:true|authentic)/i,
  /\bunlock\b/i,
  /\bempower(?:s|ing)?\b/i,
  /\bseamless\b/i,
  /\brevolutionary\b/i,
];

async function assertTextNotClipped(page: Page, locator = "main") {
  const issues = await page.evaluate((sel) => {
    const root = document.querySelector(sel) || document.body;
    const bad: string[] = [];
    const walk = (el: Element) => {
      const style = window.getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") {
        return;
      }
      if (el instanceof HTMLElement) {
        const text = el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE
          ? (el.textContent || "").trim()
          : "";
        if (text.length > 8) {
          if (
            (style.overflow === "hidden" || style.overflowX === "hidden") &&
            el.scrollWidth > el.clientWidth + 2
          ) {
            bad.push(`overflow-x: ${text.slice(0, 40)}`);
          }
          if (el.getClientRects().length === 0) {
            bad.push(`no-rects: ${text.slice(0, 40)}`);
          }
        }
      }
      for (const c of el.children) walk(c);
    };
    walk(root);
    return bad.slice(0, 10);
  }, locator);
  expect(issues, `clipped/hidden text: ${issues.join("; ")}`).toEqual([]);
}

async function assertReadableContrastSurface(page: Page) {
  const { color, bg, fontSize } = await page.evaluate(() => {
    const body = document.body;
    const cs = getComputedStyle(body);
    const main = document.querySelector("main");
    const mcs = main ? getComputedStyle(main) : cs;
    return {
      color: mcs.color,
      bg: cs.backgroundColor,
      fontSize: parseFloat(mcs.fontSize || "16"),
    };
  });
  expect(color).not.toEqual(bg);
  expect(fontSize).toBeGreaterThanOrEqual(14);
}

async function assertFooterChrome(page: Page, path: string) {
  if (path === "/sample/") {
    const cue = page.locator("footer.innsigle-footer .innsigle-seal .cue");
    await expect(cue).toHaveCount(1);
    expect((await cue.innerText()).trim()).toBe(BRAND.SAMPLE_CUE);
    return;
  }

  const footerCue = page.locator("footer.site-footer .innsigle-footer-seal .cue");
  expect(await footerCue.count()).toBeGreaterThanOrEqual(1);
  const text = (await footerCue.first().innerText()).trim();
  expect(text).toBe(BRAND.B4);
  expect(text).not.toMatch(/Colo\s*·/i);
  expect(text).not.toMatch(/not a detector/i);

  const sealLink = page.locator("footer.site-footer").getByRole("link", { name: /Innsigle/i });
  await expect(sealLink.first()).toBeVisible();
  const href = await sealLink.first().getAttribute("href");
  expect(href || "").toMatch(/\/use\/colophon\/?$/);
}

test.describe("Design voice — desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "desktop screenshots only on chromium project");
  });

  for (const shot of SHOT_PAGES) {
    test(`${shot.name}: content visible + screenshot`, async ({ page }) => {
      await page.goto(shot.path, { waitUntil: "networkidle" });

      await test.step("key copy visible", async () => {
        for (const re of shot.mustSee) {
          await expect(page.getByText(re).first()).toBeVisible();
        }
      });

      await test.step("footer chrome B4 / sample SAMPLE_CUE", async () => {
        await assertFooterChrome(page, shot.path);
      });

      if (shot.path === "/") {
        await test.step("home H1 exact B4", async () => {
          await expect(
            page.getByRole("heading", { level: 1, name: BRAND.B4, exact: true }),
          ).toBeVisible();
        });
      }

      if (shot.path === "/non-goals/") {
        await test.step("non-goals A1 phrase in main", async () => {
          const mainText = await page.locator("main").innerText();
          expect(includesA1Phrase(mainText)).toBe(true);
        });
      }

      if (shot.path === "/use/walkthrough-provenance/") {
        await test.step("walkthrough demo cue exact WALKTHROUGH_CUE", async () => {
          const cue = page.locator(".story-footer-demo .cue");
          await expect(cue).toHaveCount(1);
          expect((await cue.innerText()).trim()).toBe(BRAND.WALKTHROUGH_CUE);
        });
      }

      await test.step("no forbidden detector/purity voice", async () => {
        const bodyText = await page.locator("body").innerText();
        for (const re of FORBIDDEN_VOICE) {
          expect(bodyText, `forbidden pattern ${re}`).not.toMatch(re);
        }
      });

      await test.step("main text not clipped / surface readable", async () => {
        await assertTextNotClipped(page, "main");
        await assertReadableContrastSurface(page);
      });

      await test.step("seal mark assets paint when present", async () => {
        const marks = page.locator('img[src*="innsigle"]');
        const count = await marks.count();
        if (count > 0) {
          const first = marks.first();
          await expect(first).toBeVisible();
          const box = await first.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.width).toBeGreaterThan(8);
          expect(box!.height).toBeGreaterThan(8);
        }
      });

      await test.step("full-page screenshot", async () => {
        await expect(page).toHaveScreenshot(`${shot.name}-desktop.png`, {
          fullPage: true,
          animations: "disabled",
        });
      });
    });
  }

  test("homepage hero exposes next-section hint (not sealed landing card)", async ({
    page,
  }) => {
    await page.goto("/");
    const { scroll, view } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      view: window.innerHeight,
    }));
    expect(scroll).toBeGreaterThan(view * 1.05);
    await expect(page.getByRole("heading", { name: /Two jobs|craft seal/i }).first()).toBeVisible();
  });
});

test.describe("Design voice — mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile screenshots only on mobile project");
  });

  const mobileShots = ["/", "/use/", "/reference/artifacts/", "/non-goals/"];

  for (const path of mobileShots) {
    const name = path === "/" ? "home" : path.replace(/\//g, "-").replace(/^-|-$/g, "");
    test(`mobile ${name}: text visible + screenshot`, async ({ page }) => {
      await page.goto(path, { waitUntil: "networkidle" });
      const main = page.locator("main").first();
      await expect(main).toBeVisible();
      const text = (await main.innerText()).trim();
      expect(text.length).toBeGreaterThan(30);
      await assertTextNotClipped(page, "main");

      await expect(page.locator('nav[aria-label="Primary"]')).toBeVisible();

      await expect(page).toHaveScreenshot(`mobile-${name}.png`, {
        fullPage: true,
        animations: "disabled",
      });
    });
  }
});
