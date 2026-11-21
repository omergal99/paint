---
name: maintenance
description: Record evidence-based agent skill usage, run concise session retrospectives, and review skill quality and cleanup thresholds. Use at session wrap-up or when changing project skills and agent guidance.
---

# Agent Development Lifecycle (ADLC)

Use this skill at the end of project sessions and when reviewing agent
instructions. Keep the process small, privacy-safe, and evidence-led.

## Session close

1. Record one session row in
   `.skills/audit/statistics/usage/records/YYYY/YYYY-MM.jsonl`, including
   sessions with no relevant skill (`"skills": []`).
2. List only relevant skills actually used or explicitly considered. Use
   `used`, `not-used`, or `not-applicable`; do not treat an unlisted skill as
   proven unused.
3. Rate only a used skill from 1–5 for usefulness in this session and include
   one short evidence statement. Do not equate low frequency with poor quality.
4. Keep records limited to date, a non-sensitive session/workstream ID, skill
   IDs, disposition, rating, and short evidence. Never store prompts, source
   code, credentials, personal data, or model/token telemetry.
5. Run `npm run audit:skills`. Report the result and a concise retro: outcome,
   checks, friction/cost, one improvement if evidence supports it, and any
   human decision still open.

Example:

```json
{"session_id":"2026-11-21-skill-maintenance","date":"2026-11-21","skills":[{"id":"agent-workflow","status":"used","rating":4,"evidence":"Kept the audit bounded and evidence-led."}]}
```

## Skill review

- Validate skill names, metadata, references, and current project paths with
  `npm run audit:skills` and the repository documentation checks.
- Review only relevant upstream guidance: for a used skill with an authoritative
  public source, check at most one focused source and record its URL/date;
  project-specific skills without an upstream equivalent are `not-applicable`.
- At 20 recorded sessions, offer a selective cleanup/revision review. At 50,
  offer a broader review of relevance, duplication, ratings, and candidate
  retirement. The audit command only reports thresholds; it never edits or
  deletes files.
- Recommend a skill change only with concrete evidence, such as repeated
  friction, a stale link, a failed check, or a clear upstream change. Keep the
  patch small, validate it, and get maintainer approval before deleting,
  archiving, or materially changing behavior.
- When changing skill behavior, run the catalog/docs checks and a focused
  representative scenario. Add a small deterministic regression/eval fixture
  only when it can reliably catch a meaningful future regression; do not add a
  benchmark framework for a one-off wording change.

## Sources

- [Agent Skills specification](https://agentskills.io/specification):
  one directory per skill, matching lowercase names, focused descriptions,
  references on demand, and progressive disclosure.
- [Google Modern Web Guidance](https://developer.chrome.com/docs/modern-web-guidance/):
  apply web-platform, compatibility, accessibility, performance, and
  verification guidance selectively; see the local
  [summary](../../../.skills/engineering/modern-web-guidance.md).
