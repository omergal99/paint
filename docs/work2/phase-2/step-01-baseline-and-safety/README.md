# Step 01 — Baseline and Safety Gate

## Goal

Make the repository trustworthy before adding behavior.

## Tasks

- Resolve the failing smoke assertions using intended product behavior.
- Restore or deliberately replace the missing community-standard document.
- Capture listener, module-size, memory, test, and Lighthouse baselines.
- Add a concise manual QA checklist and CI gate.

## Done when

`npm test`, syntax checks, and diff checks are green; baseline numbers and known
limitations are committed to the phase-2 docs.

