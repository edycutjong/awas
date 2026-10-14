# Security policy

## Reporting a vulnerability

Use GitHub's private vulnerability reporting (Security tab → Report a vulnerability). Please do not open a public issue
for a vulnerability. This is a hackathon project maintained by one person; expect a reply within a few days.

## What is protected, and how it is tested

- **Secrets:** Token Factory, Tavily and Object Storage credentials exist only as deployment environment variables. They
  are never committed; CI runs gitleaks over the full history on every push.
- **Pasted ads:** stored 75 days under an unguessable case id, `noindex`, phone numbers masked. The per-connection
  limit stores a salted hash of the IP, never the address.
- **Model output cannot become a verdict:** a quote is shown only if code finds it verbatim in the fetched page text, and
  the verdict is computed by code (`src/lib/verdict.ts`), covered by unit tests.
- **Bench and judge controls:** the benchmark endpoint and the judge bypass are separate secrets compared on the server
  and never exposed to the client.
- **Dependencies:** `npm audit --omit=dev --audit-level=high` runs in CI; Dependabot security alerts are on.
