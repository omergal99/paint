# Paint agent guidance

`AGENTS.md` is the required entry point. This directory contains project
guides; loadable Agent Skills live in `.agents/skills/`. Read only the notes
relevant to the task.

## Engineering

- [Coding](engineering/coding.md) - KISS, SSOT, readable ES modules.
- [Architecture](engineering/architecture.md) - logic/data/UI boundaries.
- [UI components](engineering/ui-components.md) - reusable, accessible UI.
- [Performance](engineering/performance.md) - browser and canvas hot paths.
- [Modern Web Guidance](engineering/modern-web-guidance.md) - concise local
  principles derived from Google's web-platform guidance.

## Quality

- [RTL and browser audit](quality/rtl-browser-audit.md) - shared layout,
  direction, positioning, canvas, and input changes.
- [SEO](quality/seo.md) - metadata and discoverability.
- [Validation](quality/validation.md) - tests, audits, and handoff evidence.

## Workflows

- [Agent workflow](workflows/agent-workflow.md) - bounded, deterministic,
  budget-conscious work and human approval gates.
- [Token efficiency](workflows/token-efficiency.md) - focused context and
  verification without sacrificing quality.
- [Feature delivery](workflows/ui-delivery.md) - reusable UI and feature
  delivery contracts; not tied to a numbered workstream.
- [Retro](retro/retro.md) - short session review; see the loadable
  [maintenance skill](../.agents/skills/maintenance/SKILL.md) for ADLC.

## Audit and reference

- [Skill usage records](audit/statistics/usage/README.md) - evidence-based
  session tracking and review thresholds.
- [Project scaffold template](references/project-scaffold.md) - archived
  generic reference, not current Paint architecture or policy.
