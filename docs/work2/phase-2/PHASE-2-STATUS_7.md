# Phase 2 — Round 7 Status

Last updated: 2026-09-20. This round is the 1.6.1 hardening patch.

| Area | Result | How to verify in the UI | Evidence / remaining gate |
|---|---|---|---|
| Empty text edge case | Done | Select Text, click the canvas, leave the textarea empty, then click outside the editor. | The editor closes, Text remains active, and Select is not activated. |
| Settings URL and last tab | Done | Open Settings → About, close it, then open Settings again. | Closing leaves a clean URL; About is restored from local storage. |
| Offline preparation | Done locally | Open Settings → App → Prepare offline use. | The service worker verifies the full shell and reports readiness; production-host install/update evidence remains open. |
| Offline reload | Verified locally | Prepare offline use, disable network in browser tools, and reload. | Paint, `#app`, and the text layer render under service-worker control. |
| Module/network strategy | Done | Inspect the browser evidence and release verifier output. | Native ES modules made 49 local JS requests and 0 Fetch/XHR requests; no bundler was added. Import-graph shell coverage is now checked in CI. |
| Internal evidence boundary | Done | Inspect `.gitignore` and `git status --short`. | Retro memory/report moved to ignored `docs-internal/retro/`; curated browser evidence stays under `output/`. |

## Verification

- `npm test`: 5/5 files passed.
- `npm run verify:release`: PASS; version `1.6.1`, 56 JavaScript files checked,
  60 service-worker assets checked, app import-graph coverage checked.
- `npm run verify:docs`: PASS.
- `git diff --check`: PASS.
- Browser evidence: [round2-offline-settings.json](../../output/playwright/phase-2/playwright-cli/round2-offline-settings.json).

Remaining Step 11 gates are Performance optimization toward 90+, a real-device
matrix, and production-host HTTPS/install evidence. Step 12 background removal,
Step 13 tabs/recovery, and unsafe full text editing remain deferred.
