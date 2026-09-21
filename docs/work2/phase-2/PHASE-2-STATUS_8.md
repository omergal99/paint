# Phase 2 - Round 8 Status

> Historical snapshot from 2026-09-20. The localization status below predates
> the completed multi-locale catalog rollout documented in Phase 3.

Last updated: 2026-09-20. This is a local release-candidate evidence round;
it is not evidence of a public production deployment or physical-device test.

| Area | Status | Local evidence | Remaining boundary |
|---|---|---|---|
| Step 07 - runtime and pointer lifecycle | Completed locally | A real pointer stroke persisted normally; after a non-persisted `pagehide`, a later pointer stroke did not draw. The local production-build journey recorded zero console errors. | A sustained memory-growth trace on a large canvas is still not exercised. |
| Step 08 - storage and recovery | Completed locally | The browser journey verified a versioned PNG `Blob` autosave record, rejected a 5000 × 7000 image before allocation, showed the corrupt-autosave discard flow, and showed the injected-quota recovery dialog plus PNG download path. | These are localhost browser fixtures, not an operating-system quota test on a user device. |
| Offline shell and update foundations | Completed locally | The production-build audit was service-worker controlled, with a content-fingerprinted shell cache and build-specific worker URL; its 12-file shell reloaded offline locally. | HTTPS installability and a deployed update journey are external gates. |
| Production build/deploy pipeline | Completed locally | `npm run build` produced `dist/`, which was served and audited locally as a production build. This proves the build-and-local-serve path only. | It does not prove a public host, CDN, TLS, deployment rollback, or deployed update. |
| Desktop Lighthouse | Local target met | Local production-build desktop Lighthouse: **Performance 100**, **Accessibility 96**, **Best Practices 100**, **SEO 100**. | The result is for repeatable localhost desktop profiling, not a production field measurement. |
| Mobile Lighthouse diagnostic | Follow-up remains | The local slow-mobile diagnostic is **Performance 76**. | Do not treat the desktop score as closing the mobile 90+ target. |
| Step 12 - background removal | Foundation only | Provider boundary, local color-key provider, optional-provider loader, size/memory limits, and tests exist. | No visible UI workflow or advanced-provider integration is shipped. |
| Step 13 - tabs, split, and recovery | Foundation only | Bounded session and recovery services, document state, and recovery tests exist. | No visible document tabs, split view, or canvas/IndexedDB UI integration is shipped. |
| Phase 3 | Localization seam started | English and Spanish catalogs now have a persisted Settings language selector, locale registry, and `html.lang`/`dir` controller; remaining languages stay disabled until reviewed catalogs exist. | Full remaining catalogs, RTL layout proof, and a visible notepad panel/tabs remain open. |

| Configurable shortcuts | Delivered locally | Settings → Shortcuts records a key combination, rejects conflicts, persists through the settings store, and resolves the action dynamically after reload. | Browser/device coverage for every platform-specific key layout remains a follow-up. |

## Verification recorded for this round

- `npm test`: **12/12** test files passed.
- `npm run typecheck`: TypeScript 7.0.2 passes as a development-only check; `npm run build` does not invoke TypeScript.
- `npm run audit:runtime`: passes without rewriting `output/quality/step-07-08-runtime-audit.json`; use `npm run audit:snapshot` only when an evidence snapshot is intentionally refreshed.
- Local production-build browser audit: real pointer/autosave, teardown,
  corrupt-autosave, quota-recovery, and large-image-admission journeys passed.
- Local desktop Lighthouse: **P100 / A96 / BP100 / SEO100**.
- Local mobile diagnostic: **P76**; this remains an explicit follow-up.

Evidence artifacts are retained under
`output/playwright/phase-2/local-audit-20260920/production-build-runtime.json`,
`output/quality/lighthouse-production-build-desktop.json`, and the
`output/README.md` retention policy.

## External launch gates still open

- Production HTTPS install proof.
- Install and update behavior on the deployed host.
- Real desktop and mobile-device matrix.
- Mobile performance work toward a 90+ result.
