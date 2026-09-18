# Skills and Tooling Recommendations

## Existing local skills

The project already has notes for architecture, coding, UI components,
performance, SEO, validation, project workflow, retro, and community audit.
They are useful contracts but do not yet cover event hygiene, editable text
layers, browser E2E, or byte-bounded canvas memory.

## Recommended external candidates

The local `npx skills find` command was attempted but npm registry access failed
with `EAI_AGAIN`, so these are recommendations only; none were installed.

1. **web-quality-audit** — combines live browser evidence with performance,
   accessibility, SEO, best-practices, and agentic browsing checks. Install:
   `npx skills add https://github.com/addyosmani/web-quality-skills --skill web-quality-audit`.
   [skills.sh listing](https://www.skills.sh/addyosmani/web-quality-skills/web-quality-audit)
2. **accessibility** from the same collection — WCAG 2.2, Lighthouse/axe, and
   manual keyboard/screen-reader workflow. Install:
   `npx skills add https://github.com/addyosmani/web-quality-skills --skill accessibility`.
   [skills.sh listing](https://www.skills.sh/addyosmani/web-quality-skills/accessibility)
3. **Playwright CLI Skill** from OpenAI — browser-first automation without
   forcing a test framework migration. Install:
   `npx skills add https://github.com/openai/skills --skill playwright`.
   [skills.sh listing](https://www.skills.sh/openai/skills/playwright)

## Recommendation

Use the first and third candidates during Steps 10–11 if installation is
approved and the environment supports them. Do not install overlapping
Playwright skills or animation libraries for this mission. Create local notes
for event hygiene, text-layer contracts, and canvas-memory budgets because
those are specific to this application and should remain project-owned.

