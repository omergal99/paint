# Community standards status

This document records the repository-level readiness review for Paint. It is
intended to be updated when community processes or GitHub settings change.

## Local repository files

| Area | Status | Evidence / next action |
| --- | --- | --- |
| Project description and setup | Present | `README.md` describes purpose, local serving, key capabilities, data flow, and documentation entry points. |
| Contributing guide | Present | `CONTRIBUTING.md` documents setup, local checks, review expectations, and a human-reviewed AI contribution path. |
| Code of conduct | Present | `.github/CODE_OF_CONDUCT.md` defines scope, expected behavior, reporting, and enforcement. |
| Security policy | Present | `SECURITY.md` directs reports away from public issues and documents scope and response. |
| Bug/feature issue templates | Present | `.github/ISSUE_TEMPLATE/` contains privacy-safe templates and security contact guidance. |
| Pull request template | Present | `.github/pull_request_template.md` asks for validation, accessibility, and security review. |
| License | Needs owner decision | No `LICENSE` file exists. Choose an appropriate license before calling the repository licensed open source. |

## Security and maintenance

- Client-side credentials are prohibited by project policy. External AI services
  are opened on their official sites; Paint does not collect provider keys.
- Browser clipboard, file access, local storage, service-worker caching, and
  external links are documented areas for future security review.
- CI and local gates cover tests, localization, typing, docs, and release
  consistency. They do not prove physical-device behavior or replace an
  independent security review.
- `AGENTS.md`, `.skills/`, and `.agents/skills/` are contributor guidance and
  tooling, not app runtime. Keep the short project entry point and the skills
  that are actively used; periodically check for duplication or obsolete
  instructions before adding more. Do not remove them solely because their
  names are hidden files.
- Dependency/security scanning and private vulnerability reporting still
  require GitHub configuration or an explicit maintainer decision.

## GitHub-hosted controls to verify manually

These cannot be proven by local files alone:

- repository description and topics;
- MFA for privileged maintainers;
- protected `main` branch and required checks/reviews;
- Dependabot or another dependency update process;
- secret scanning and private vulnerability reporting enabled;
- issue labels and triage ownership;
- at least two appropriately permissioned administrators.

## Operating rule

Run the project skill at
`.agents/skills/community-standards-audit/SKILL.md` after major feature, security,
workflow, or public-documentation changes. Keep this document evidence-based;
do not mark external GitHub settings as complete without checking them there.
