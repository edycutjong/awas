import { expect, test } from "@playwright/test";

// Credential-free paths only: a judge's cold visit, and the guards that run before any upstream call.

test("home loads with the paste box and no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Awas — home" })).toBeVisible();
  await expect(page.getByLabel(/paste the job ad/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Periksa/ })).toBeDisabled();
  await expect(page.getByText(/recorded cases|rekaman|try a recorded case/i).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("head carries icon, description and social card", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Awas/);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", /icon\.svg/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /og-image\.png/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
});

test("an ad that is too short is refused before anything is searched", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/paste the job ad/i).fill("gaji tinggi");
  await page.getByRole("button", { name: /Periksa/ }).click();
  await expect(page.getByText(/too short to check/i)).toBeVisible();
});

test("/judge answers with no credentials, no session and no redirect", async ({ request, page }) => {
  const res = await request.get("/judge", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  await page.goto("/judge");
  await expect(page.getByText(/No login, no daily cap/)).toBeVisible();
  await expect(page.getByText(/decided by code, never by the model/)).toBeVisible();
});

test("/integrations and the recorded-samples API answer without a key", async ({ request }) => {
  expect((await request.get("/integrations")).status()).toBe(200);
  const samples = await request.get("/api/samples");
  expect(samples.status()).toBe(200);
  expect(typeof (await samples.json()).count).toBe("number");
});

test("healthz reports upstream names, never values", async ({ request }) => {
  const res = await request.get("/api/healthz");
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(JSON.parse(body).ok).toBe(true);
  expect(body).not.toMatch(/tvly-|secret|AKIA/i);
});

test("the benchmark and judge-only controls refuse a stranger", async ({ request }) => {
  const res = await request.post("/api/samples", { data: { caseId: "x", slug: "x", label: "x" } });
  expect(res.status()).toBe(403);
});

test("a case that does not exist is a 404 and the API marks it noindex", async ({ request }) => {
  expect((await request.get("/case/does-not-exist")).status()).toBe(404);
  const api = await request.get("/api/case/does-not-exist");
  expect(api.status()).toBe(404);
  expect(api.headers()["x-robots-tag"]).toBe("noindex");
});
