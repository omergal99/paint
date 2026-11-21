---
name: deterministic-test-fixer
description: Run the local deterministic browser suite, diagnose browser regressions, and fix application code without weakening test intent.
---

# Deterministic test and fix loop

Use this skill when running or diagnosing Paint's local browser tests. Read the
[harness guide](../../../tests/SKILL.md) for runner layout, environment, and
cross-project reuse.

## Non-negotiable rules

1. Never delete a failing test or weaken its assertion to make the suite pass.
   Change test intent only after the user or maintainer explicitly approves a
   product/spec change.
2. Browser execution is deterministic and AI-free. AI may diagnose or propose
   a source fix, but must not be part of the test runner.
3. Do not claim a fix worked from source inspection alone. Rerun the complete
   local suite and verify exit code `0`.
4. Do not suppress console errors, uncaught exceptions, or failed conditions
   just to produce a passing result.

## Workflow

1. Run `npm run test:local` and capture the failing test name, viewport, error,
   and failure screenshot if one was produced.
2. Identify the root cause from the failure evidence and relevant application
   source. Separate a browser/setup prerequisite failure from a product
   regression.
3. Make the smallest appropriate application or harness fix. Leave test
   assertions unchanged unless an approved specification change requires a
   test update.
4. Rerun the full `npm run test:local` suite after each fix attempt; check both
   the existing Node tests and all desktop/mobile browser tests.
5. After three unsuccessful attempts at the same failure, stop and report the
   evidence and unresolved cause for maintainer input.

## Review summary

Report:

- **Failed journey:** test name and viewport.
- **Root cause:** what failed and why, with evidence.
- **Change:** files changed and concise explanation.
- **Verification:** exact command and full-suite result.
- **Remaining uncertainty:** any browser or manual validation not covered.

