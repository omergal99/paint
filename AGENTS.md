# paint agent guide

Before changing this app, read [`.skills/README.md`](.skills/README.md) and the
specific skill notes relevant to the task. Keep this file as the short entry
point; detailed guidance belongs in `.skills/`.

Required habits:

- Keep logic, persisted data, and UI rendering separate.
- Prefer one source of truth (SSOT), small composable functions, and KISS.
- Reuse or extend infrastructure components before adding one-off UI logic.
- Keep settings, events, defaults, and mirrored controls synchronized.
- Avoid duplication and unnecessary work in hot paths; preserve canvas pixels.
- Validate with `npm test`, syntax checks, and `git diff --check` before handoff.
- Do not add provider secrets, arbitrary code execution, or native browser alert UI.
- For shared layout, direction, positioning, canvas, or input changes, perform
  a whole-app impact-surface inventory and browser matrix; classify physical
  coordinates before changing them. See [`.skills/rtl-browser-audit.md`](.skills/rtl-browser-audit.md).

For public-project readiness, security, or contributor-workflow changes, also
read [`.skills/community-standards-audit/SKILL.md`](.skills/community-standards-audit/SKILL.md)
and its relevant references.
