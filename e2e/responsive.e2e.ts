import { expect, test } from "@playwright/test";

for (const [name, width, height] of [["phone", 375, 812], ["tablet", 768, 1024], ["desktop", 1440, 900]] as const) {
  for (const path of ["/", "/judge", "/integrations"]) {
    test(`${path} has no horizontal scroll at ${name} (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

test("primary button is a comfortable touch target on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel(/paste the job ad/i).fill("x".repeat(50));
  const box = await page.getByRole("button", { name: /Periksa/ }).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(36);
});
