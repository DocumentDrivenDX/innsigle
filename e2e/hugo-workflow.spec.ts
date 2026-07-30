import { test, expect } from "@playwright/test";
import { existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const captures = join(root, "docs/website/static/captures");

/**
 * Site-facing proof that the Hugo walkthrough is documented and has a screencast.
 * Full CLI seal path: tests/hugo-workflow.test.mjs (requires hugo).
 */
test.describe("Hugo × Innsigle walkthrough on site", () => {
  test("walkthrough page loads with publish contract + proof", async ({ page }) => {
    await page.goto("/use/walkthrough-hugo/");
    await expect(page.locator("h1")).toContainText(/Hugo/i);
    const main = page.locator("main");
    await expect(main).toContainText(".innsigle");
    await expect(main).toContainText(/well-known/i);
    await expect(main).toContainText(/VALID|workflow/i);
    await expect(main).toContainText(/AGENTS\.md|publish/i);

    // Screencast embed (mp4 source)
    const video = page.locator('video source[type="video/mp4"]');
    await expect(video).toHaveCount(1);
    const src = await video.getAttribute("src");
    expect(src).toMatch(/walkthrough-hugo\.mp4/);
  });

  test("screencast capture files exist for site static", async () => {
    const mp4 = join(captures, "walkthrough-hugo.mp4");
    const gif = join(captures, "walkthrough-hugo.gif");
    // At least one motion asset must ship; prefer mp4
    const hasMp4 = existsSync(mp4) && statSync(mp4).size > 1000;
    const hasGif = existsSync(gif) && statSync(gif).size > 1000;
    expect(
      hasMp4 || hasGif,
      "missing docs/website/static/captures/walkthrough-hugo.mp4 (or .gif); run: npm run record:hugo-walkthrough",
    ).toBeTruthy();
  });
});
