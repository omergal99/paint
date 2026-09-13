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
npx serve .
# or
python3 -m http.server 8000
```

Run the repository checks before submitting a change:

```bash
npm test
git diff --check
node --check js/main.js
```

For JavaScript changes, also run `node --check` on each changed module.

## Code expectations

- Keep logic, persisted data, and UI rendering separate.
- Prefer small functional modules, one source of truth, and reusable UI
  infrastructure over one-off handlers.
- Preserve existing user data and settings behavior unless the change is
  explicitly a migration.
- Keep browser permissions and external data transfers visible to users.
- Add or update a focused smoke test for important user-facing contracts.

## Pull requests

Use the pull request template. Keep each PR focused, explain the user impact,
list validation commands, and include before/after screenshots for visual
changes. A maintainer may request a smaller PR when unrelated cleanup makes a
change difficult to review.
