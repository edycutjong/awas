#!/usr/bin/env node
/**
 * Interaction feedback, measured: every interactive element class must look different when hovered and when focused
 * from the keyboard (screenshot, act, screenshot, byte-compare). Exits 1 if any element shows no change.
 *
 *   node scripts/hover_check.mjs [--base https://awas-cek.vercel.app]
 */

import { chromium } from "@playwright/test";

const i = process.argv.indexOf("--base");
const BASE = (i > 0 ? process.argv[i + 1] : "https://awas-cek.vercel.app").replace(/\/+$/, "");
const sample = (await (await fetch(`${BASE}/api/samples`)).json()).samples.find((s) => s.lines.some((l) => l.status === "verified")) ?? null;

const targets = [
  { page: "/", name: "Check button", sel: "button.btn" },
  { page: "/", name: "masthead link", sel: "a.mast" },
  { page: "/", name: "footer link", sel: ".foot a" },
  { page: "/judge", name: "sample chip", sel: ".chip-btn" },
  ...(sample
    ? [
        { page: `/case/${sample.id}`, name: "evidence URL", sel: "a.url" },
        { page: `/case/${sample.id}`, name: "flag source link", sel: ".flag a" },
        { page: `/case/${sample.id}`, name: "Copy button", sel: "button.btn" },
        { page: `/case/${sample.id}`, name: "Share link", sel: "a.btn" },
        { page: `/case/${sample.id}`, name: "details summary", sel: "details > summary" },
      ]
    : []),
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
let failed = 0;
let current = "";
for (const t of targets) {
  if (t.page !== current) {
    await page.goto(`${BASE}${t.page}`, { waitUntil: "networkidle" });
    current = t.page;
  }
  // The Check button is disabled until there is text to check.
  if (t.name === "Check button") await page.locator("textarea").fill("Dibutuhkan admin online untuk Kamboja, gaji Rp 15 jt.");
  const el = page.locator(t.sel).first();
  if ((await el.count()) === 0) {
    console.log(`SKIP  ${t.name} — not on ${t.page}`);
    continue;
  }
  await el.scrollIntoViewIfNeeded();
  await sleep(700);
  await page.mouse.move(0, 0);
  await sleep(400);
  // The focus ring is drawn outside the element's box (outline-offset), so every shot keeps an 8 px margin around it.
  const box = await el.boundingBox();
  const clip = { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: box.width + 16, height: box.height + 16 };
  const shot = () => page.screenshot({ clip });
  const before = await shot();
  await el.hover();
  await sleep(450);
  const hovered = await shot();
  await page.mouse.move(0, 0);
  await sleep(450);
  await page.keyboard.press("Tab"); // keyboard modality, so :focus-visible applies to the focus below
  await el.focus();
  await sleep(450);
  const focused = await shot();
  await el.evaluate((n) => n.blur());
  const hoverOk = Buffer.compare(before, hovered) !== 0;
  const focusOk = Buffer.compare(before, focused) !== 0;
  if (!hoverOk || !focusOk) failed++;
  console.log(`${hoverOk && focusOk ? "PASS" : "FAIL"}  ${t.name} — hover ${hoverOk ? "changes" : "NO CHANGE"}, keyboard focus ${focusOk ? "changes" : "NO CHANGE"}`);
}
const css = await (await fetch(`${BASE}/`)).text();
const sheet = [...css.matchAll(/href="(\/_next\/static\/[^"]+\.css)"/g)].map((m) => m[1]);
let reduced = false;
for (const s of sheet) reduced ||= /prefers-reduced-motion/.test(await (await fetch(`${BASE}${s}`)).text());
console.log(`${reduced ? "PASS" : "FAIL"}  a prefers-reduced-motion guard ships in the app's stylesheet`);
if (!reduced) failed++;
await browser.close();
process.exit(failed ? 1 : 0);
