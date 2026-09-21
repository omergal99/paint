# Verification output policy

This directory keeps only small, curated evidence that is linked by the
current Phase 2 documents:

- `playwright/phase-2/local-audit-20260920/` - current local browser evidence.
- `playwright/phase-2/playwright-cli/` - named round fixtures still referenced by docs.
- `quality/lighthouse-local-20260920.json` - current local diagnostic.
- `quality/lighthouse-production-build-desktop.json` - current production-build desktop result.
- `quality/step-07-08-runtime-audit.json` - intentional historical snapshot.

Timestamped screenshots, raw Lighthouse iterations, and exploratory traces are
not release inputs. They are moved to the ignored `docs-internal/evidence-archive/`
directory when no current document links to them. Re-run `npm run audit:runtime`
for a live contract check; use `npm run audit:snapshot` only when a new snapshot
is deliberately requested.
