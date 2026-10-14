import { expect, test } from "@playwright/test";

// The story page (/about) and the pitch deck (/pitch): static files in public/, served through next.config rewrites.

for (const [name, width, height] of [["phone", 375, 812], ["tablet", 768, 1024], ["desktop", 1440, 900]] as const) {
  for (const path of ["/about", "/pitch"]) {
    test(`${path} has no horizontal scroll at ${name} (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

test("/about: the hero highlighter is set by the quote gate running in the page", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/about");
  await expect(page.locator("#hero-hl")).not.toHaveClass(/\boff\b/);
  await expect(page.locator("a.hero-frag").first()).toHaveAttribute("href", /#:~:text=/);
  expect(errors).toEqual([]);
});

test("/about: the gate drops a flipped clause and keeps the page's own sentence", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("button", { name: "One clause flipped" }).click();
  await expect(page.locator("#gate-result .gate-card.dropped")).toContainText("dropped: not in the page");
  await page.getByRole("button", { name: "The page’s own sentence" }).click();
  await expect(page.locator("#gate-result .gate-card.verified a")).toHaveAttribute("href", /#:~:text=/);
  await expect(page.locator("#page-text mark")).toContainText("Dokumen bermasalah");
  await page.getByRole("button", { name: "Cut short" }).click();
  await expect(page.locator("#gate-result .gate-card.verified .cut")).toContainText("Cut from a longer sentence");
});

test("/about: the rules lab fires no rule on a negated ad and STOP on the composite", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("button", { name: "Negated" }).click();
  await expect(page.locator("#rules-result")).toContainText("NO RULE FIRED");
  await page.getByRole("button", { name: "The composite ad" }).click();
  await expect(page.locator("#rules-result .v-stop")).toContainText("tourist or visit visa offered for work");
});

test("/pitch: ten slides, the arrow key moves forward and the stage fits the window", async ({ page }) => {
  await page.goto("/pitch");
  await expect(page.locator(".slide")).toHaveCount(10);
  await expect(page.locator("#count")).toHaveText("01 / 10");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#count")).toHaveText("02 / 10");
  const fits = await page.evaluate(() => {
    const r = document.getElementById("stage")?.getBoundingClientRect();
    if (!r) return false;
    return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  });
  expect(fits).toBe(true);
});
