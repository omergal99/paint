# Paint agent guide

Read [`.skills/README.md`](.skills/README.md) and only the task-relevant guides
before changing the app. Project guides live under `.skills/`; loadable agent
skills live under `.agents/skills/`.

For multi-step, planning, retro, or multi-agent work, read
[`.skills/workflows/agent-workflow.md`](.skills/workflows/agent-workflow.md).

## Required habits

- Keep logic, persisted data, and UI rendering separate.
- Prefer one source of truth (SSOT), small composable functions, and KISS.
- Reuse or extend infrastructure components before adding one-off UI logic.
- Keep settings, events, defaults, and mirrored controls synchronized.
- Every user-visible text change must use an existing i18n key or add one to
  `js/i18n/messages.js`, `js/i18n/uiText.js`, and every ready locale catalog;
  remove obsolete keys/text and run `npm run check:i18n`.
- Avoid duplication and unnecessary work in hot paths; preserve canvas pixels.
- Validate with `npm test`, relevant syntax checks, and `git diff --check`.
- Do not add provider secrets, arbitrary code execution, or native browser alert UI.
- For shared layout, direction, positioning, canvas, or input changes, perform
  a whole-app impact-surface inventory and browser matrix; classify physical
  coordinates before changing them. See
  [the RTL/browser audit guide](.skills/quality/rtl-browser-audit.md).
- For public-project readiness, security, or contributor-workflow changes, use
  [the community standards skill](.agents/skills/community-standards-audit/SKILL.md)
  and its relevant references.

At session wrap-up, record relevant skills as used or considered in
`.skills/audit/statistics/usage/records/` and run `npm run audit:skills`.
Do not infer historical usage from missing telemetry.
