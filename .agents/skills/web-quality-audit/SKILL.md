---
name: web-quality-audit
description: Run an evidence-led quality audit for the local-first Paint Online canvas editor.
license: MIT
metadata:
  author: web-quality-skills
  version: "2.0-project-adapted"
---

# Paint Online web-quality audit

Use this skill for measured reviews of Paint's browser runtime, canvas
interactions, accessibility, SEO/PWA readiness, and launch quality. Keep
observations from a live browser separate from source-only hypotheses.

## Scope

Paint is a vanilla ES-module, local-first image editor. The relevant surfaces
are the public shell, ribbon, menus, dialogs, canvas/overlay, history/sidebar,
storage/recovery, and narrow/floating layouts. There is no login flow, server
rendering, video/audio content, ad surface, or multi-page navigation to audit.

## Evidence-led workflow

1. Define the URL, viewport, browser, and journey being audited.
2. Start the local static server and capture a cold-load baseline.
3. Use the Playwright CLI skill for snapshots, interactions, screenshots,
   console output, network output, and traces.
4. Use Lighthouse for rendered Accessibility, SEO, Best Practices, and PWA
   evidence. Use a performance trace or Lighthouse Performance separately.
5. Use `scripts/analyze.sh paint/index.html` for source smoke checks; it is not
   a replacement for rendered evidence.
6. Re-run the same journey after a fix and report browser-only checks that were
   not available.

## Required Paint journeys

- cold load and reload with the service worker available/unavailable;
- draw, select, move, resize, undo, and redo on a normal canvas;
- open settings, change a General value, switch tabs, and close the dialog;
- open History/Session, restore, export, and delete an entry;
- resize a whole canvas and a selected region, including ratio lock;
- create transparent pixels and save/reload a PNG;
- narrow viewport and floating/left/bottom ribbon layouts;
- large-canvas stress check with history and storage enabled.

## Metrics

### Public-shell metrics

- LCP < 2.5s, INP < 200ms, and CLS < 0.1 where the tested page state allows
  those metrics to be meaningful.
- Lighthouse Accessibility, SEO, Best Practices, and PWA findings.
- Console errors, failed same-origin requests, and service-worker failures.

### Editor-specific metrics

- pointermove handler count and duplicate coordinate/layout work;
- long tasks during drawing, zooming, menus, and history rendering;
- memory growth across repeated snapshots, undo/redo, image import, and clear;
- decoded bitmap, scratch canvas, Blob, and object-URL cleanup;
- ribbon title alignment and total height in every supported layout.

## Severity

| Level | Paint action |
|---|---|
| Critical | Data loss, crash/OOM, security issue, or unusable core editor |
| High | Major Core Web Vital/a11y failure or broken save/edit workflow |
| Medium | Measured interaction, layout, storage, SEO, or offline defect |
| Low | Cleanup or optimization with no current user-visible failure |

## Audit report format

```markdown
## Audit results

### Evidence
| Signal | Conditions | Result | Evidence |
|---|---|---|---|
| INP | viewport, journey, browser | measured value | trace/Lighthouse |

### Findings
- **[Severity] [Category]** file or rendered control
  - Impact:
  - Evidence: measured / reproduced / source hypothesis
  - Fix:

### Verification
- exact command or browser journey;
- before/after result;
- manual or field evidence still pending.
```

Do not promise search ranking from a Lighthouse score. Do not add WebMCP or
`llms.txt` only to improve an audit category. Keep SEO focused on the existing
title, metadata, canonical, robots, sitemap, structured data, and public URL.

## Launch checklist

- [ ] `npm test`, syntax checks, and `git diff --check` pass.
- [ ] No console errors in the required journeys.
- [ ] Lighthouse categories and PWA installability have recorded results.
- [ ] Keyboard and focus checks pass for menus, tabs, dialogs, and history.
- [ ] Large-canvas and storage failure behavior is visible and recoverable.
- [ ] Offline shell works or the limitation is explicitly documented.
