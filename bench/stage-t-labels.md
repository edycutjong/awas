# Stage-T labels — how they were drafted

`stage-t-labels.jsonl` holds six fields for each of the 25 dev rows, following `STAGE-T.md`. They were drafted by the
build agent (`labeller: agent (DRAFT-UNREVIEWED)`) on 2026-10-15, hashed into `MANIFEST.json` and committed **before any
model saw a dev row**. Until a human reviews them, every stage-T number is reported "vs agent labels, unreviewed".

Every value is an exact substring of its row's text (checked by script before writing). Where `STAGE-T.md` leaves a
choice open, the labels follow these conventions, fixed before any run:

- **company** — the recruiting company when an ad names both a recruiter and a foreign employer (in the official
  board's ads: the licensed placement company, not the employer abroad). Several recruiting companies named together
  → the phrase that names them all.
- **destination** — where the offered work is. "luar negeri" (abroad) names no place → `null`.
- **job** — several positions offered together → the phrase that names them all.
- **fees** — money the applicant pays, including a salary deduction or a loan to be repaid from wages.
- **promises** — each distinct phrase stating a benefit (pay, a free ticket, documents arranged, a listed facility);
  the same benefit stated twice in different words is two items, because the text states it twice.
