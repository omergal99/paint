# Paint Online - Work 2 / Phase 2 Plan

This directory is the planning and implementation evidence source of truth for
the next development cycle. Application code changes are recorded beside the
step that owns them and must pass the documented gates.

## Navigation

- [Simple next steps](NEXT-STEPS-SIMPLE.html) - current plain-English continuation plan.
- [Plan overview](PLAN-OVERVIEW.md) - priority order, dependencies, milestones.
- [Plan details](PLAN-DETAILS.md) - implementation examples and acceptance criteria.
- [Target architecture](TARGET-ARCHITECTURE.md) - proposed module and data boundaries.
- [Traceability matrix](TRACEABILITY-MATRIX.md) - every user request mapped to a step.
- [Quality gates](QUALITY-GATES.md) - tests, performance, memory, Lighthouse, and release gates.
- [Decisions](DECISIONS.md) - decisions and unresolved owner choices.
- [Phase 2 status](PHASE-2-STATUS.md) - current delivery status and quick UI checks for every step.
- [Next plan status](NEXT-PLAN-STATUS.md) - short execution queue, current gates, and browser-matrix evidence.
- [Round 8 status](PHASE-2-STATUS_8.md) - current local runtime, recovery, build, and Lighthouse evidence.
- [Round 8 visual status](PHASE-2-STATUS_8.html) - concise white-theme view of the current evidence and open launch gates.
- [Completion summary](WORK-COMPLETION-SUMMARY.html) - short visual guide with shortcut examples, test commands, and Mermaid diagrams.
- [Round 2 status](PHASE-2-STATUS_2.md) - historical stabilization results, scores, gaps, and UI walkthrough.
- [Round 2 visual status](PHASE-2-STATUS_2.html) - accessible HTML tables/meters for that historical round.
- [Round 3 status](PHASE-2-STATUS_3.md) - current UI fixes, seams, browser fixtures, matrix, and updated score.
- [Round 3 visual status](PHASE-2-STATUS_3.html) - white-theme HTML status for the current round.
- [Round 3 web-quality report](WEB-QUALITY-AUDIT-ROUND3.json) - analyzer, browser, and final-gate results.
- [Round 2 web-quality reports](WEB-QUALITY-AUDIT-ROUND2.json) - analyzer output for the app and status page.
- [Steps 01–08 audit](STEP-01-08-AUDIT.md) - completeness check, transparency ownership, and remaining gates.
- [Progress log](PROGRESS-LOG.md) - planning and later implementation evidence.
- [HTML overview](PLAN-OVERVIEW.html) - visual overview with Mermaid diagrams.
- [Phase 3 plan](../phase-3/README.md) - localization/RTL and persistent notepad planning.

## Step workspaces

Each step has a small README with scope, dependencies, deliverables, and a
definition of done. Steps are ordered by dependency and risk, not by how easy a
feature is to describe.

## Planning status

- Status: **Steps 07 and 08 are locally verified for runtime teardown and storage recovery; Step 11 has a locally audited production build and desktop Lighthouse P100/A96/BP100/SEO100. Public HTTPS install/update, real-device proof, and mobile Performance 90+ remain open. Steps 12/13 and Phase 3 are implemented foundations, not visible feature workflows.**
- Current verification includes `npm test` **12/12**, TypeScript 7 dev-only checking, and the Round 8 local browser evidence. See `PHASE-2-STATUS.md` before treating a local result as a launch claim.
- Existing Phase 1 is treated as historical input, not blindly repeated.
- The referenced `paint/docs/w2/PLAN-OVERVIEW.html` does not exist in this
  checkout. Existing Phase 1 documents are used instead, and the missing-file
  dependency is recorded in `DECISIONS.md`.
