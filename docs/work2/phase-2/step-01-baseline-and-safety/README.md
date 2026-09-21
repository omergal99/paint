# Step 01 - Baseline and Safety Gate

## Goal

Make the repository trustworthy before adding behavior.

## Tasks

- Resolve the failing smoke assertions using intended product behavior.
- Correct references to the existing canonical document at
  `docs/work1/COMMUNITY_STANDARDS.md`; do not duplicate it at a new path.
- Treat remaining docs/tests path drift as maintenance debt, not a product
  blocker after the correction.
- Capture listener, module-size, memory, test, and Lighthouse baselines.
- Add a concise manual QA checklist and CI gate.

## Done when

`npm test`, syntax checks, and diff checks are green; baseline numbers and known
limitations are committed to the phase-2 docs.
