# Contributing

Awas is a hackathon entry (Nebius Global AI Hackathon, 2026). Issues about wrong verdicts are the most useful contribution.

## Run it

```bash
npm ci
npm run ci        # lint, typecheck, vitest, npm audit
npm run build && npm run e2e
```

No credentials are needed for the test suite or the browser tests. A live check needs `TOKENFACTORY_API_KEY` and a Tavily key
(see the README); never commit them.

## Rules of the repository

- Commit prefixes decide the release version: `feat:` minor, `fix:`/`perf:` patch, `feat!:` major; `docs:`, `chore:`,
  `test:`, `ci:` produce no release.
- Name regression tests after the defect they pin.
- The verdict is decided by code in `src/lib/verdict.ts`, never by a model. A change that lets a model decide a verdict
  will not be merged.
- Once the `code-freeze` tag exists, `src/lib` is frozen: the published benchmark describes that exact code. Changes there
  must say in `DEMO.md` that the headline no longer applies.
- Every statistic in the README must have a page and a verbatim sentence in `docs/SOURCES.md`.
- Never paste real phone numbers or personal data into tests, issues or fixtures.
