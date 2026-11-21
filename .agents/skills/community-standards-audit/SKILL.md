---
name: community-standards-audit
description: Audit an open-source repository for community standards, security readiness, documentation, and contributor workflows.
---

# Community Standards Audit

Use this skill when reviewing or improving a repository's public-project readiness. It applies to the `paint` project and can be reused for similar applications.

## Outcome

Produce an evidence-based audit with four states: present, missing, needs owner decision, or blocked by external repository settings. Implement safe local improvements when they are clearly specified; do not silently choose legal policy, licensing, maintainer contacts, or GitHub account settings.

## Workflow

1. Read the repository's `AGENTS.md`, existing project skills, README, package metadata, workflows, and current contribution/security files before editing.
2. Inspect the repository tree and git status. Preserve unrelated user changes and do not delete files merely because they are unfamiliar.
3. Check the project against [references/community-checklist.md](references/community-checklist.md).
4. Apply the security review in [references/security-review.md](references/security-review.md), especially secrets, browser-stored credentials, dependency risk, workflow permissions, and safe vulnerability reporting.
5. Improve documentation links and local templates when the correct project-specific content is known. Use placeholders only for values that require maintainer input, and call them out explicitly.
6. Treat a license as an owner decision. If no license exists, report the gap and offer candidates; do not add a legal license without authorization.
7. Separate local evidence from GitHub-hosted controls. MFA, branch protection, private vulnerability reporting, repository description, labels, and settings cannot be verified from files alone.
8. Validate with the repository's tests, syntax checks, formatting checks, and any documentation link or template checks available. Report skipped checks and why.

## Required report

Summarize:

- what was inspected;
- each checklist item with evidence and status;
- changes made and files added;
- owner decisions still required;
- external GitHub settings still required;
- validation commands and results.

Never include secrets in reports. If a possible secret is found, identify only its file and safe remediation path, then stop before exposing the value.

Read the supporting references only when doing the corresponding audit. The references summarize the project-specific checklist and link to the authoritative Open Source Guides; they are not a replacement for repository evidence.
