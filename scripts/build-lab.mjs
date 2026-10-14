// Compiles the landing page's lab (public/landing/lab.js) from the app's own src/lib — rubric, quote gate, verdict —
// so the page runs the same code as the app. Run after any change to those files: `npm run build:lab`.
// tests/lab.test.ts fails while the bundle is older than its sources.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { build } from "rolldown";

const root = path.resolve(import.meta.dirname, "..");
const SOURCES = [
  "src/lib/text.ts", "src/lib/rubric.ts", "src/lib/rule-sources.ts", "src/lib/gate.ts", "src/lib/verdict.ts",
  "src/lib/types.ts", "scripts/lab/entry.ts", "scripts/lab/sha256.ts",
];
const hash = createHash("sha256");
for (const f of SOURCES) hash.update(`${f}\n${readFileSync(path.join(root, f), "utf8")}\n`);
const sourceSha = hash.digest("hex");

await build({
  cwd: root,
  input: path.join(root, "scripts/lab/entry.ts"),
  platform: "browser",
  resolve: { alias: { "node:crypto": path.join(root, "scripts/lab/sha256.ts") } },
  output: {
    file: path.join(root, "public/landing/lab.js"),
    format: "iife",
    name: "AwasLab",
    banner: `/* Awas lab: src/lib compiled for the browser by scripts/build-lab.mjs (MIT).\n * lab-sources: ${SOURCES.join(" ")}\n * source-sha256: ${sourceSha} */`,
  },
});
console.log(`public/landing/lab.js  source-sha256 ${sourceSha.slice(0, 12)}`);
