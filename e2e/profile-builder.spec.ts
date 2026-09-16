import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { validateProfile, UNSIGNED_LABEL } from "../src/profile.mjs";

test.describe("Maker profile builder", () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "builder interaction on chromium only");
  });

  test("sample profile page is unsigned and lists works", async ({ page }) => {
    const res = await page.goto("/examples/profile/", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Sample maker" })).toBeVisible();
    await expect(page.getByText(UNSIGNED_LABEL).first()).toBeVisible();
    await expect(page.getByText("Q3 strategy memo")).toBeVisible();
    await expect(page.getByText("Board note, 12 Sep")).toBeVisible();
    await expect(page.getByText(/\bVALID\b/)).toHaveCount(0);
    await expect(page.getByText(/verified authentic/i)).toHaveCount(0);
  });

  test("builder adds a mixed work, preview stays unsigned, JSON downloads", async ({
    page,
  }) => {
    await page.goto("/use/profile/", { waitUntil: "networkidle" });
    await expect(page.locator("#innsigle-profile-builder")).toBeVisible();
    await expect(page.locator("#pb-name")).toBeVisible();

    await page.locator("#pb-name").fill("Ada Maker");
    await page.locator("#pb-id").fill("ada");
    await page.locator("#pb-url").fill("https://ada.example/innsigle/");
    await page.locator("#pb-title").fill("Q3 strategy memo");
    await page.locator("#pb-work-url").fill("https://example.com/memo");
    await page.getByRole("radio", { name: "mixed" }).check();
    await page.locator("#pb-model").fill("Claude");
    await page.getByRole("button", { name: "Add this work" }).click();

    await expect(page.locator("#pb-footer")).toContainText("Innsigle · mixed");
    await expect(page.locator("#pb-footer")).toContainText("q3-strategy-memo");
    await expect(page.locator("#pb-bio-card")).toContainText("Ada Maker");
    await expect(page.locator("#pb-work-error")).toBeHidden();

    const preview = page.frameLocator("#profile-preview");
    await expect(preview.getByRole("heading", { name: "Ada Maker" })).toBeVisible();
    await expect(preview.getByText("Q3 strategy memo")).toBeVisible();
    await expect(preview.getByText(UNSIGNED_LABEL).first()).toBeVisible();
    await expect(preview.getByText(/\bVALID\b/)).toHaveCount(0);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Download profile.json" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("innsigle-profile.json");
    const path = await download.path();
    expect(path).toBeTruthy();
    const profile = validateProfile(JSON.parse(readFileSync(path!, "utf8")));
    expect(profile.id).toBe("ada");
    expect(profile.works).toHaveLength(1);
    expect(profile.works[0].colophon.composition).toBe("mixed");
    expect(profile.works[0].colophon.ingredients.some((i) => i.kind === "model")).toBeTruthy();
  });

  test("builder refuses human-authored plus a named model", async ({ page }) => {
    await page.goto("/use/profile/", { waitUntil: "networkidle" });
    await expect(page.locator("#pb-name")).toBeVisible();
    await page.locator("#pb-name").fill("Ada Maker");
    await page.locator("#pb-id").fill("ada");
    await page.locator("#pb-title").fill("Laundered memo");
    await page.getByRole("radio", { name: "human-authored" }).check();
    await page.locator("#pb-model").fill("Claude");
    await page.getByRole("button", { name: "Add this work" }).click();
    const err = page.locator("#pb-work-error");
    await expect(err).toBeVisible();
    await expect(err).toContainText(/human-authored cannot list a model/i);
    await expect(page.locator("#pb-works li")).toHaveCount(0);
  });
});
