# Loadable agent skills

Each child directory with a `SKILL.md` is a loadable skill. Activate one only
when its description matches the current task; read its references on demand.
The project-wide entry point is `../../AGENTS.md`.

| Skill | Use when |
|---|---|
| [Accessibility](accessibility/SKILL.md) | Auditing or changing rendered accessibility |
| [Community standards audit](community-standards-audit/SKILL.md) | Reviewing public-project readiness, security, or contribution workflows |
| [Deterministic test fixer](deterministic-test-fixer/SKILL.md) | Running local browser tests and fixing regressions without weakening tests |
| [Maintenance](maintenance/SKILL.md) | Session retro, skill usage records, or skill lifecycle review |
| [Paint architecture](paint-architecture/SKILL.md) | Changing JavaScript module seams, UI state, or cross-feature contracts |
| [Playwright](playwright/SKILL.md) | Validating Paint in a real browser through the CLI |
| [Web quality audit](web-quality-audit/SKILL.md) | Measuring Paint runtime, canvas, storage, accessibility, or launch quality |

Keep detailed project guides in `.skills/`; keep each loadable skill focused
and progressively disclosed.
