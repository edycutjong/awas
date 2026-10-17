#!/usr/bin/env node
/**
 * Text-fragment check (spec §2 step 5): open every verified line's `url#:~:text=…` link in a real browser and record
 * whether the rendered page contains the quote. A card says "found on the live page <date>" only for lines this check
 * saw; every other card says "open the page and search for: <first 6 words>". A failed fragment opens the page top with
 * no error, which is why this is checked in a browser and not assumed.
 *
 *   node scripts/fragment_check.mjs --case <caseId> [--base https://awas.edycu.dev]   # prints {"<index>": "<date>"}
 *   node scripts/fragment_check.mjs --pack pack.json
 *
 * Needs Playwright's Chromium (`npx playwright install chromium`). Output: JSON on stdout, one line per check on stderr.
 */

import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1] ?? ""]] : acc), []),
);

/** The same comparison the quote gate makes, reduced to what a rendered page can give: case, quotes, dashes, spaces. */
function normalise(s) {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’‚‛′ʼ`´]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/[‐-―−⸺⸻]/g, "-")
    .replace(/[​-‍⁠﻿­]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function loadPack() {
  if (args.pack) return JSON.parse(readFileSync(args.pack, "utf8"));
  const base = (args.base || "https://awas.edycu.dev").replace(/\/+$/, "");
  const res = await fetch(`${base}/api/case/${args.case}`);
  if (!res.ok) throw new Error(`GET /api/case/${args.case} → ${res.status}`);
  return res.json();
}

const pack = await loadPack();
const today = new Date().toISOString().slice(0, 10);
const found = {};
const browser = await chromium.launch();
const context = await browser.newContext({
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
  viewport: { width: 1280, height: 900 },
});
for (const [index, line] of (pack.lines ?? []).entries()) {
  if (line.status !== "verified" || !line.fragmentUrl) continue;
  const page = await context.newPage();
  let verdict = "not found";
  try {
    await page.goto(line.fragmentUrl, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(2500); // JavaScript-rendered pages (kemlu.go.id, humas.polri.go.id) fill in late
    const text = normalise(await page.evaluate(() => document.body?.innerText ?? ""));
    if (text.includes(normalise(line.quote))) {
      found[index] = today;
      verdict = "found";
    }
  } catch (e) {
    verdict = `error: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`;
  }
  process.stderr.write(`  line ${index} ${verdict} — ${line.url}\n`);
  await page.close();
}
await browser.close();
process.stdout.write(`${JSON.stringify(found)}\n`);
