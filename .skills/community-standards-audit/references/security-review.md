# Security review

Apply this review to browser apps and repositories that may handle user images, clipboard data, local storage, or external services.

## Trust boundaries

Identify what stays local, what leaves the browser, and what an external site controls. Document clipboard reads/writes, file-system APIs, service workers, local/session storage, analytics, third-party links, and AI integrations.

## Secrets

- Search source, history-safe working files, workflow definitions, docs, and examples for tokens, passwords, private keys, provider keys, and embedded credentials.
- Do not print suspected secret values. Recommend revocation/rotation and history cleanup when exposure is possible.
- Do not add a client-side credential field unless the user explicitly accepts the risk and the product has a documented secure design. Prefer provider-hosted login or user-controlled external links.
- Treat browser local storage as readable by any script running in the origin; it is not a secret vault.

## Dependencies and automation

- Check package manifests, lockfiles, and workflows for dependency/update coverage.
- Review workflow permissions and artifact handling. Do not widen permissions to make a check pass.
- Prefer reproducible checks: syntax, tests, diff whitespace, dependency audit where supported, and static security scanning where configured.

## Reporting and response

`SECURITY.md` should direct suspected vulnerabilities away from public issues. It should state scope, supported versions, expected acknowledgment, and a lightweight response path. Do not invent a private email address; use a maintainer-provided address or GitHub private vulnerability reporting and mark the missing route as an owner decision.

## Browser-specific checks

- External links use `target="_blank"` with `rel="noopener noreferrer"` when appropriate.
- Native dialogs, uploads, clipboard, and downloads explain what data is accessed and when.
- User images are not uploaded merely by opening a feature.
- Service-worker cache entries include new local assets and do not cache credentials or private content.
