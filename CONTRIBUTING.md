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

The app is a static browser application. Start the repository's local server
so ES modules and browser APIs work:

```bash
npm run serve
```

Node.js 24 or newer is required for repository scripts. Install the locked
development dependencies, then run the checks relevant to the change:

```bash
npm install
npm test
npm run test:local
npm run test:browser -- --list
npm run test:browser -- --test brush-desktop
npm run check:i18n
npm run typecheck
npm run verify:docs
git diff --check
```

`npm run test:local` runs the existing Node suite followed by deterministic
desktop and mobile browser checks. It requires an installed Chrome or Chromium
browser, adds no browser-automation npm dependency, and is local-only; the
existing GitHub Actions test workflow is unchanged. See the
[test harness guide](./tests/SKILL.md) and
[testing ADR](./docs/adr/testing/ADR-0002-local-deterministic-browser-tests.md).
Every browser run writes JSON and standalone HTML reports under
`output/test-artifacts/runs/`; `output/test-artifacts/latest.json` points to the
most recent run. See the harness guide for group selection and timeout options.

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

## Optional references for review

These are references, not additional project requirements. Review the
relevance and fit before incorporating any guidance:

- [Google Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance)
  — web-platform, compatibility, accessibility, and performance advice for
  agents.
- [Web Platform Baseline](https://web.dev/baseline/)
  — cross-browser availability of web features.
- [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web)
  — HTML, CSS, JavaScript, and Web API reference.
- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
  — accessible widget patterns and keyboard behavior.
- [WCAG 2.2 Quick Reference](https://www.w3.org/WAI/WCAG22/quickref/)
  — accessibility criteria and techniques.
- [web.dev Learn Performance](https://web.dev/learn/performance/)
  — practical performance fundamentals.
- [Agent Skills specification](https://agentskills.io/specification)
  — portable format and progressive-disclosure guidance for agent skills.

Paint keeps a short local summary of selected web principles in
`.skills/engineering/modern-web-guidance.md`; it does not install or vendor the
upstream catalog.

## Pull requests

Use the pull request template. Keep each PR focused, explain the user impact,
list validation commands, and include before/after screenshots for visual
changes. A maintainer may request a smaller PR when unrelated cleanup makes a
change difficult to review.
