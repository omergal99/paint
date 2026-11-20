# Contributing to Paint

Thank you for helping improve Paint. Documentation, accessibility fixes,
reproducible bug reports, tests, and focused code changes are all welcome.

## Before opening an issue or pull request

- Search existing issues first.
- For a bug, include reproducible steps, expected behavior, actual behavior,
  browser/OS details, and a minimal screenshot or recording when useful.
- Never include passwords, API keys, private images, personal data, or other
  secrets in an issue, pull request, log, or screenshot.
- Security vulnerabilities must follow [SECURITY.md](SECURITY.md), not a
  public issue.

## Local development

The app is a static browser application. Serve the project over HTTP so ES
modules and browser APIs work:

```bash
python3 -m http.server 8000
```

Node.js 24 or newer is required for repository scripts. Install the locked
development dependencies, then run the checks relevant to the change:

```bash
npm install
npm test
npm run check:i18n
npm run typecheck
npm run verify:docs
git diff --check
```

For JavaScript changes, run `node --check` on changed modules. For service
worker/module graph, version, or release changes, run `npm run verify:release`.
For user-visible UI changes, include browser/keyboard evidence and screenshots
when they help explain the result.

## Code expectations

- Keep logic, persisted data, and UI rendering separate.
- Prefer small functional modules, one source of truth, and reusable UI
  infrastructure over one-off handlers.
- Preserve existing user data and settings behavior unless the change is
  explicitly a migration.
- Keep browser permissions and external data transfers visible to users.
- Add or update a focused smoke test for important user-facing contracts.
- Keep user-visible text in the shared i18n messages and every ready locale.
- Keep `docs-internal/` local-only; publish only reviewed public guidance.

## AI-assisted contributions

AI tools may help implement or review a change, but they do not replace
maintainer judgment or CI:

1. **Context:** read `AGENTS.md`, `.skills/README.md`, and the relevant
   project skill; start from an issue or a concrete user problem.
2. **Plan:** state the scope, acceptance checks, data/storage impact, and
   accessibility/localization risks before changing broad seams.
3. **Build:** make one reviewable change, preserve existing user data, and add
   focused tests for the behavior.
4. **Review:** have a fresh reviewer inspect the diff independently; the
   implementation agent should not be the only reviewer.
5. **Risk gate:** explicitly consider security, privacy, permissions,
   accessibility, RTL, i18n, storage limits, and failure UX where applicable.
6. **Merge and deploy:** report exact commands and browser evidence in the PR.
   CI and a human maintainer decide whether it is ready; do not grant an agent
   merge or deployment authority by default.

[Google's Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance)
can inform performance, accessibility, CSS, and platform API decisions. Use
only guidance relevant to the change and reconcile it with Paint's local-first
architecture and repository instructions; do not install it wholesale.

## Pull requests

Use the pull request template. Keep each PR focused, explain the user impact,
list validation commands, and include before/after screenshots for visual
changes. A maintainer may request a smaller PR when unrelated cleanup makes a
change difficult to review.
