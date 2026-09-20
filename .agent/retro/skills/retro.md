---
name: retro
version: 3.1.0
description: Evidence-led four-hat retrospective for the Paint workspace.
---

# Retro operating rules

Review four perspectives: user workflow, agent self-correction, domain/ecosystem
risks, and future blind spots. Separate observations from hypotheses and attach
each important claim to a command, browser fixture, source file, or external
reference.

Use this round shape:

- Scope: one sentence.
- Must fix: numbered acceptance behaviors.
- Should improve: non-blocking refinements.
- Deferred: features that require stronger proof.
- Evidence: exact commands, viewport, browser state, and saved artifact.
- Release impact: customer-facing, internal tooling, or documentation only.

The execution gate is mandatory: investigate first, present a selectable action
plan, wait for confirmation, then implement only the approved items. If no
sub-agent runner is available, state that limitation and perform the review
transparently in the main agent.

Prefer small patches. After each patch run the narrowest relevant check, then
run static checks, unit tests, browser checks, and documentation consistency in
that order. Never present raw listener counts as leak proof, never claim a PWA
gate closed without real-browser evidence, and never force a service-worker
reload while active editing can lose user work.

Persist non-sensitive findings in `.agent/retro/memory/`, index sessions in
`.agent/retro/index.json`, and create a white/light report under
`.agent/retro/reports/` with Mermaid, before/after metrics, proposals,
examples, proof, and limitations.
