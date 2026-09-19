# Phase 3 — Decisions

| Decision | Choice | Reason |
|---|---|---|
| Translation fallback | English catalog is always available | The local-first app must remain usable when a locale is incomplete |
| Direction state | `lang` and `dir` are one language-service update | Prevents mixed-direction UI and stale accessibility metadata |
| Canvas direction | Keep image coordinates unchanged | RTL changes surrounding UI, not the meaning of image pixels |
| Notepad storage | Versioned local storage with bounds and safe normalization | Simple refresh persistence without pretending to be sync or backup |
| Notepad format | Plain text first | Lower risk, smaller payloads, and easier recovery |
| Phase 2 release | Prepare a release candidate before Phase 3 | User approval is required before pushing a new customer version |
