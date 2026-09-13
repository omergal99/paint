# Security Policy

## Scope

The latest `main` branch and the deployed Paint web application are the
supported security scope. Older revisions and forks may not contain current
fixes.

## Report a vulnerability privately

Please do not open a public issue, pull request, or discussion for a suspected
vulnerability. Use GitHub's private vulnerability reporting for the repository
when it is enabled:

<https://github.com/omergal99/paint/security/advisories/new>

If private reporting is unavailable, contact [@omergal99 on GitHub](https://github.com/omergal99)
privately and request a secure reporting route. Do not send credentials,
private user images, or exploit details through a public channel.

Include a concise description, affected revision or URL, reproduction steps,
impact, and a safe proof of concept where possible. Please redact secrets and
personal data.

## Response process

The maintainer will acknowledge a report when reasonably possible, reproduce
and assess its severity, coordinate a fix, and communicate a mitigation or
release when appropriate. Timing depends on severity and maintainer capacity;
please allow private coordination before public disclosure.

## User safety boundaries

Paint should not request provider passwords or API keys, upload images without
an explicit user action, or expose private local data through logs or external
links. If you find behavior that violates these boundaries, report it as a
security issue rather than a normal feature request.
