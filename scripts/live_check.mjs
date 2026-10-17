#!/usr/bin/env node
/**
 * The spec's MUST list and its product guards, checked on the live app in a real browser at phone and laptop width.
 * Reads only what any visitor can read: the paste page, /judge, every recorded sample's evidence file, /integrations.
 *
 *   node scripts/live_check.mjs [--base https://awas-cek.vercel.app] [--shots <dir>]
 *
 * Prints one PASS/FAIL line per check and exits 1 on any FAIL. With --shots, saves full-page screenshots.
 */

import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const BASE = arg("base", "https://awas-cek.vercel.app").replace(/\/+$/, "");
const SHOTS = arg("shots", "");
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

const samples = await (await fetch(`${BASE}/api/samples`)).json();
const browser = await chromium.launch();

for (const vp of [{ name: "390", width: 390, height: 844 }, { name: "1280", width: 1280, height: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // Paste screen.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const body = await page.locator("body").innerText();
  check(`[${vp.name}] paste box and Check button, no login`, (await page.locator("textarea").count()) === 1 && (await page.getByRole("button", { name: /periksa|check/i }).count()) > 0 && !/log ?in|sign ?in|masuk/i.test(await page.locator("form").first().innerText().catch(() => "")));
  check(`[${vp.name}] image-ad hint, privacy line and 75-day retention line on the paste screen`, /salin-teks/i.test(body) && /data pribadi/i.test(body) && /75 hari/.test(body));
  check(`[${vp.name}] no horizontal scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  check(`[${vp.name}] judge strip: no login, no daily cap`, /no login, no daily cap/i.test(body));
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `paste-${vp.name}.png`), fullPage: true });

  // /judge: five recorded samples, each labelled with its recording date.
  await page.goto(`${BASE}/judge`, { waitUntil: "networkidle" });
  const judgeText = await page.locator("body").innerText();
  check(`[${vp.name}] /judge lists ${samples.count} recorded samples with a recording date`, samples.count === 5 && (judgeText.match(/recorded run/gi) ?? []).length >= 5, `${samples.count} samples`);

  // Every sample's evidence file.
  for (const s of samples.samples) {
    await page.goto(`${BASE}/case/${s.id}`, { waitUntil: "networkidle" });
    const t = await page.locator("body").innerText();
    const tag = `[${vp.name}] ${s.sampleLabel?.slice(0, 38) ?? s.id}`;
    const robots = await page.locator('meta[name="robots"]').getAttribute("content").catch(() => null);
    check(`${tag}: noindex`, /noindex/.test(robots ?? ""));
    check(`${tag}: one of the three verdicts, no score, no "safe"`, /STOP|VERIFY FIRST|PERIKSA DULU|NO RED FLAGS FOUND|TIDAK DITEMUKAN/.test(t) && !/\b\d{1,3}\s?%\s*(risk|risiko)|\bsafe\b|\baman\b/i.test(t.replace(/not a guarantee|bukan jaminan/gi, "")));
    if (s.flags.length) check(`${tag}: every flag shows its rule source (domain + date)`, (await page.locator(".flag").count()) === s.flags.length && (await page.locator(".flag a").count()) >= s.flags.filter((f) => f.source).length);
    const verified = s.lines.filter((l) => l.status === "verified");
    if (verified.length) {
      check(`${tag}: every shown quote links its page with a text fragment`, (await page.locator('a.url[href*="#:~:text="]').count()) >= verified.length);
      check(`${tag}: claims labelled "not verified", glosses "not evidence"`, /not verified/i.test(t) && (!verified.some((l) => l.glossStatus) || /translation — not evidence|translation unavailable/i.test(t)));
      check(`${tag}: a Tavily call chip with credits`, /credit/i.test(t) && /search|extract/i.test(t));
    }
    if (s.lines.some((l) => l.status === "dropped")) check(`${tag}: a dropped line is shown as dropped`, /not found in the page|tidak ditemukan di halaman/i.test(t));
    check(`${tag}: family message with Copy and a wa.me share link`, (await page.getByText(/Salin · Copy/).count()) > 0 && (await page.locator('a[href^="https://wa.me/?text="]').count()) > 0);
    if (s.verdict === "STOP" && verified.some((l) => s.messageId.includes(l.quote))) check(`${tag}: quoted lines end with the attribution`, /bukan tuduhan kami/.test(s.messageId));
    check(`${tag}: "How this was checked" receipt names the Nemotron models`, /nemotron/i.test(t) && /how this was checked/i.test(t));
    check(`${tag}: retention and noindex stated on the file`, /75 (hari|days)/i.test(t));
    check(`${tag}: phone digits masked except the last 4`, !/(?:\+?62|\b0)8\d{2}[\s.-]?\d{3,4}[\s.-]?\d{2,}/.test(s.adTextMasked));
    check(`${tag}: no horizontal scroll`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `case-${s.sampleLabel?.slice(0, 12).replace(/\W+/g, "-") ?? s.id}-${vp.name}.png`), fullPage: true });
  }

  // /integrations: anonymised receipts only.
  await page.goto(`${BASE}/integrations`, { waitUntil: "networkidle" });
  const it = await page.locator("body").innerText();
  check(`[${vp.name}] /integrations shows receipts with model IDs and credits, no ad text`, /nemotron/i.test(it) && /credit/i.test(it) && !/lowongan|gaji|visa turis/i.test(it));
  check(`[${vp.name}] no uncaught page errors`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks pass`);
process.exit(failed.length ? 1 : 0);
