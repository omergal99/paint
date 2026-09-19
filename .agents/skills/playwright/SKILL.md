---
name: "playwright"
description: "Use the Playwright CLI to exercise Paint Online in a real browser, capture UI evidence, and debug local flows."
---

# Paint Online Playwright CLI

Use this skill for real-browser validation of the local Paint app. Keep it
CLI-first; do not introduce `@playwright/test` or a new test framework unless
the user explicitly asks for test files.

## Prerequisite

```bash
command -v npx >/dev/null 2>&1
```

If unavailable, stop and report that Node.js/npm must be installed. The bundled
wrapper uses `npx --package @playwright/cli playwright-cli`.

## Project setup

Run from `paint/` and keep artifacts inside the repository:

```bash
export PAINT_ROOT="$(pwd)"
export PWCLI="${PAINT_ROOT}/.agents/skills/playwright/scripts/playwright_cli.sh"
mkdir -p output/playwright/phase-2
python3 -m http.server 4173
```

Use a named session for repeatable checks:

```bash
"$PWCLI" --session paint-phase2 open http://127.0.0.1:4173/
"$PWCLI" --session paint-phase2 snapshot
```

## Required interaction loop

1. Open the local URL.
2. Snapshot before using element references.
3. Interact with the latest references.
4. Snapshot after menus, dialogs, tabs, or layout changes.
5. Capture a screenshot, console output, network output, or trace when it is
   evidence for a finding.

## Paint journeys

- ribbon More menu and shape gallery open/close behavior;
- settings tabs, General choices, close/focus behavior;
- History/Session tab order, restore, export, and delete;
- resize percentage, ratio lock, selected-region behavior;
- transparent canvas and PNG export;
- palette context menu and keyboard fallback;
- text editor/history/context edit when that feature is enabled;
- 320px/narrow, 1280px, and floating ribbon layouts.

## Useful commands

```bash
"$PWCLI" snapshot
"$PWCLI" click e12
"$PWCLI" press Escape
"$PWCLI" resize 320 720
"$PWCLI" screenshot output/playwright/phase-2/settings.png
"$PWCLI" console warning
"$PWCLI" network
"$PWCLI" tracing-start
"$PWCLI" tracing-stop
```

Use `eval` only for read-only inspection needed to measure rendered state. Do
not use it to bypass the snapshot/ref workflow or to mutate application state.

## Guardrails

- Re-snapshot when a reference is stale.
- Keep browser artifacts under `output/playwright/`.
- Never automate third-party sites for this project.
- Report headed/browser-only checks separately from Node tests.
- The future tabs/split work may use browser tabs, but normal Paint validation
  should not depend on multi-tab browser automation.
