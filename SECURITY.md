# Security policy

## Reporting a vulnerability

Please do not open a public issue for a vulnerability. Contact the maintainer, @edycutjong, through their GitHub profile;
once this repository is public, use GitHub's private vulnerability reporting (Security tab → Report a vulnerability).
This is a hackathon project maintained by one person; expect a reply within a few days.

## What is protected, and how it is tested

- **Secrets:** Token Factory, Tavily and Object Storage credentials exist only as deployment environment variables. They
  are never committed. CI runs gitleaks on every pushed commit and pull request, and the full history is scanned
  (`gitleaks git`) before the repository is made public.
- **Pasted ads:** stored under an unguessable case id, served `noindex`, phone numbers masked except the last 4 digits in the stored ad text and extracted phone fields (flag excerpts and other extracted spans are stored as pasted, so a personal-recruiter excerpt can still hold the digits; see DEMO.md §8).
  Retention is a bucket lifecycle rule on `cases/` (75 days, set when the bucket was created); the local fallback store
  used for a judge's own run never expires. The per-connection limit stores a daily-salted hash of the IP, never the
  address; set `AWAS_RATE_SALT` in production, because without it the salt's secret part is a public default.
- **Model output cannot become a verdict:** a quote is shown only if code finds it verbatim in the fetched page text, and
  the verdict is computed by code (`src/lib/verdict.ts`), covered by unit tests.
- **Bench and judge controls:** the benchmark endpoint and the judge bypass are separate secrets compared on the server
  and never exposed to the client.
- **Dependencies:** `npm audit --omit=dev --audit-level=high` runs in CI; Dependabot security alerts are on.
