---
name: agent-workflow
description: Budgeted, deterministic, documented, and independently reviewed AI-agent workflow for Paint and docs-internal.
---

# Agent workflow

Use this skill for multi-step, multi-agent, planning, retro, or workstream tasks.
It complements the existing coding, architecture, performance, validation, and
Playwright skills. Do not replace a repository-specific skill with this guide.

## 1. Start with a bounded objective

- State one measurable goal, a small in/out scope, and the acceptance evidence.
- Read `AGENTS.md`, `.skills/README.md`, and only the relevant skill notes.
- For `docs-internal/`, also read `docs-internal/AGENTS.md` and the relevant
  folder's `index.md` or `AGENTS.md`.
- Set a small token/context budget before editing:
  - planning and baseline: narrow, read-only, deterministic;
  - implementation: one coherent patch or one independently defined phase;
  - verification: exact commands and a concise result;
  - retro: one action list and one HTML/Markdown report.
- Stop and compress/ask for guidance if scope, evidence, or a gate is unclear.

## 2. Use deterministic tools before model reasoning

- Collect facts with `rg`, `glob`, `git`, file views, tests, linters, and CLI
  scripts before sending context to a model or sub-agent.
- Send only a diff, exact line range, command output, or compact artifact.
  Never dump a whole archive or oversized file as a substitute for search.
- Use scripts for repeated collection, counting, link checks, sorting, and
  validation. Store a rerunnable command or script rather than rebuilding the
  same context manually.
- Distinguish source facts, focused tests, browser evidence, prior evidence,
  and unverified hypotheses in every status report.

## 3. Split work only when responsibility is independent

- Use a sub-agent only for a bounded review, exploration, or implementation
  seam that benefits from separate context and can be independently verified.
- Give every sub-agent: objective, relevant files, stop condition, required
  output, and evidence commands. Do not use one agent to review its own work.
- Do not delegate a continuous code trace that can be completed directly with
  focused reads. Avoid nested relaunches for the same objective.
- Use independent review for meaningful diffs, but keep implementation and
  verification authority in the main agent or explicit human reviewer.

## 4. Edit surgically and preserve behavior

- Prefer existing helpers, constants, stores, and UI components.
- Batch coherent edits. Do not rewrite healthy files or migrate unrelated
  directories.
- Keep logic, persisted data, and UI rendering separate.
- Preserve canvas pixels, user data, i18n catalogs, release versions, and
  service-worker state unless the task explicitly changes them.
- Remove temporary artifacts and tests that no longer apply.
- Do not add secrets, provider credentials, native alert UI, arbitrary code
  execution, or public copies of private `docs-internal/` material.

## 5. Verify before reporting

Run the smallest covering check, then expand only for the affected surface:

1. `node --check` for changed JavaScript modules.
2. Focused tests or browser journeys for changed behavior.
3. `npm test` for a meaningful repository-wide change.
4. `npm run verify:docs` for public or internal documentation changes.
5. `git diff --check` before handoff.
6. Release, i18n, service-worker, RTL, or Lighthouse checks only when the task
   changes their owning surface.

Report exact command/result pairs and explicitly mark browser-only, device-only,
or production-only work as unverified.

## 6. Document what the next agent needs

Create or update one concise source of truth:

- implementation status and evidence in the dated workstream or P1–P5 plan;
- visual human status in a Hebrew RTL HTML report for project/feature decisions;
- report lifecycle entries in `docs-internal/status/reports/`;
- `docs-internal/log.md` for structural or source-of-truth changes;
- an unpushed commit summary only when useful to the handoff.

Preserve prior reports. A new project report must be dated and add/archive
without overwriting the prior pair.

## 7. Retro and continuous improvement

After a meaningful milestone or an actual overrun/failure, run a short retro:

- what was done and evidence;
- token/context or tool cost that was wasted;
- one deterministic automation or check that would prevent repetition;
- one skill or instruction that needs updating;
- one human decision or gate that remains.

Keep the retro short and actionable. Store it in
`docs-internal/retro/` when it is durable project knowledge. Generate a visual
HTML summary only when a report is useful to the user.

Do not auto-update skills or project rules merely from a single guess. Update
only after evidence and, when the change affects behavior or governance,
independent review or human approval.

## 8. Human gates

Stop for explicit approval before:

- destructive or rewriting Git operations;
- pushing or publishing;
- adding provider credentials or external data transfer;
- changing license, public API, or distribution policy;
- broad migrations or large UI architecture rewrites;
- deleting historical evidence or overwriting reports;
- merging, deployment, or autonomous release actions.

## Copy-paste prompt for a new project session

```text
Use the repository's agent workflow:

1. Read AGENTS.md, .skills/README.md, .skills/agent-workflow.md,
   docs-internal/AGENTS.md, and only relevant folder skills.
2. Restate the objective, scope, acceptance evidence, and stop condition.
3. Gather facts deterministically; read only diff-sized or line-bounded sources.
4. Use sub-agents only for independent bounded review or implementation;
   independently verify their output.
5. Make one coherent surgical patch and preserve existing behavior/data.
6. Run the smallest covering checks, then repository checks required by the
   changed surface. Report exact PASS/FAIL evidence.
7. Update canonical Markdown source and visual HTML status when applicable.
8. Preserve reports/history and record structural changes in docs-internal/log.md.
9. Finish with an actionable retro: wasted context, reusable automation,
   skill update, and remaining human gates.
```
