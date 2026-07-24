import { test, expect, type Page } from "@playwright/test";

/**
 * Design-voice visual assessment (DESIGN.md + product-microsite-ia).
 * - Screenshots for human/reviewer inspection and optional baseline diffs
 * - Assertions that copy is visible, not clipped, and voice rules hold
 */

const SHOT_PAGES: { name: string; path: string; mustSee: RegExp[] }[] = [
  {
    name: "home",
    path: "/",
    mustSee: [/craft seal/i, /colophon/i, /INN-siggle|Innsigle/i, /not a detector|Not a purity/i],
  },
  {
    name: "why",
    path: "/why/",
    mustSee: [/Why Innsigle/i, /gap|C2PA|Not By AI/i],
  },
  {
    name: "use",
    path: "/use/",
    mustSee: [/Use Innsigle/i, /Walkthrough/i, /CLI/i],
  },
  {
    name: "colophon",
    path: "/use/colophon/",
    mustSee: [/colophon/i, /model-primary|human-authored|mixed/i, /Edit is not origin/i],
  },
  {
    name: "verify",
    path: "/use/verify/",
    mustSee: [/Verify/i, /signature|digest|content/i],
  },
  {
    name: "marks",
    path: "/use/marks/",
    mustSee: [/Marks/i, /Matrix|Brand|Cartouche|Ring/i, /human-authored|model-primary/i],
  },
  {
    name: "walkthrough-docs",
    path: "/use/walkthrough-docs/",
    mustSee: [/Walkthrough/i, /seal a docs page/i, /keygen|claim build|verify/i],
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
    mustSee: [/Not an AI detector/i, /Not a C2PA replacement/i],
  },
  {
    name: "dogfood",
    path: "/dogfood/",
    mustSee: [/dogfood|model-primary|Innsigle/i],
  },
];

/**
 * Soft design-voice anti-patterns (promoting detection / purity theater).
 * Negated educational copy ("not a purity score", "not a detector") is allowed —
 * only flag affirmative product claims.
 */
const FORBIDDEN_VOICE = [
  /verified authentic content/i,
  /AI detection score/i,
  /detector accuracy/i,
  /\bdetects AI content\b/i,
  /(?:offers|shows|includes|displays)\s+(?:a\s+)?purity score/i,
  /(?:guarantees|proves)\s+(?:the\s+)?content is (?:true|authentic)/i,
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
          // Overflow: content wider than client with hidden overflow
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
  // Design tokens: body text color should not equal background (rough gate)
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
    // First viewport should not be the only content — scroll height > viewport
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

      // Nav remains usable
      await expect(page.locator('nav[aria-label="Primary"]')).toBeVisible();

      await expect(page).toHaveScreenshot(`mobile-${name}.png`, {
        fullPage: true,
        animations: "disabled",
      });
    });
  }
});
