# Agent skill usage records

This is a compact, privacy-safe baseline for the maintenance skill. Records are
JSON Lines, one session per line, stored by year and month under `records/`.
Started 2026-11-21; earlier sessions are not backfilled because available local
history does not contain reliable skill-invocation telemetry. Missing history
means unknown, not zero use.

## Record format

Each record has a unique `session_id`, ISO `date`, and `skills` array. Use
`used`, `not-used`, or `not-applicable` for relevant skills only. A `used`
entry requires a 1–5 usefulness rating and a short evidence string; other
statuses require a short reason and must not have a rating. When an upstream
source is checked, optionally include `source_check: {"url": "https://...",
"date": "YYYY-MM-DD"}`. An empty array records a session with no relevant
skill.

Do not store prompts, source code, user data, credentials, or model/token
telemetry. Keep session IDs non-sensitive and descriptive, such as a date plus
a short workstream slug.

## Review

Run `npm run audit:skills` to validate loadable-skill metadata and records, then
see per-skill uses and mean usefulness. An absent skill is not proof that it
was unused; only an explicit `not-used` entry records that decision. Ratings
measure usefulness in a recorded session, not intrinsic skill quality.

- At 20 session records, offer a selective cleanup/revision review.
- At 50, offer a broader review of relevance, duplication, ratings, and
  retirement candidates.

The command never edits or deletes files. Any cleanup requires evidence and
maintainer approval. For a skill with an authoritative public source, the
maintenance skill calls for one bounded source check when it is used or
reviewed; project-specific skills may be marked not applicable.
