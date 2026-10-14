/**
 * The landing page's lab: the app's own rubric, quote gate and verdict, compiled for the browser by
 * scripts/build-lab.mjs. Nothing here re-implements them; it only re-exports src/lib.
 */
export { evaluateRubric, FLAG_LABELS } from "../../src/lib/rubric";
export { addToCorpus, fragmentUrl, gateLine, MIN_QUOTE_WORDS } from "../../src/lib/gate";
export { decide } from "../../src/lib/verdict";
export { normalise, words } from "../../src/lib/text";
