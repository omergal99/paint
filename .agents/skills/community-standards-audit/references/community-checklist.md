# Community standards checklist

Use this as an audit matrix. Record evidence rather than assuming that a filename alone means the process is complete.

## Public project basics

- README explains purpose, audience, status, setup, usage, browser/runtime support, tests, roadmap, support path, contribution path, and license status.
- Repository description and topics are configured on the hosting platform.
- A license is present and matches the maintainer's intended reuse model. If absent or uncertain, mark `needs owner decision`.
- `CONTRIBUTING.md` explains setup, tests, coding expectations, issue/PR flow, and scope.
- `CODE_OF_CONDUCT.md` states expected behavior, scope, reporting route, and enforcement ownership.
- `SECURITY.md` gives a private security-reporting route, supported versions/scope, expected response, and basic disclosure process.

## GitHub collaboration files

- Bug report issue template asks for reproducible steps, expected/actual behavior, environment, and privacy-safe evidence.
- Feature request template asks for user problem, proposed outcome, alternatives, and acceptance criteria.
- Pull request template asks for summary, testing, screenshots when relevant, compatibility/accessibility/security impact, and checklist confirmation.
- Templates do not request secrets or encourage public disclosure of vulnerabilities.
- README links to the community files and issue forms.

## Product documentation

- Architecture and data-flow docs identify the composition root, feature modules, persistent storage, external services, and trust boundaries.
- User-facing docs explain privacy-sensitive behavior such as clipboard, file access, local storage, analytics, and external AI links.
- Release/version guidance has one source of truth and a reproducible validation path.
- Accessibility, browser support, offline/PWA behavior, and known limitations are documented.

## Repository hygiene

- No credentials, private data, generated reports, local caches, or personal machine files are tracked.
- `.gitignore` covers project-specific generated artifacts without hiding source files or security reports.
- Workflows use least privilege, pin sensible action major versions, run tests, and avoid leaking secrets in logs.
- Dependencies and lockfiles are handled consistently; dependency updates and vulnerability review have an owner.
- Tests cover important user-facing contracts and do not rely only on brittle wording checks.

## External controls

Mark these as `external` unless verified through an authorized GitHub integration:

- MFA for privileged maintainers;
- protected default branch and required checks/reviews;
- Dependabot/Renovate and secret scanning;
- private vulnerability reporting;
- repository description, topics, labels, and issue triage;
- at least two appropriately permissioned administrators.

## Authoritative reading

- [Open Source Guides](https://opensource.guide/)
- [Starting an Open Source Project](https://opensource.guide/starting-a-project/)
- [Your Code of Conduct](https://opensource.guide/code-of-conduct/)
- [Security Best Practices](https://opensource.guide/security-best-practices-for-your-project/)
