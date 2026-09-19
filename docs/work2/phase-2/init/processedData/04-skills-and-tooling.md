# Skills and Tooling Recommendations

## Existing local skills

The project already has notes for architecture, coding, UI components,
performance, SEO, validation, project workflow, retro, and community audit.
They are useful contracts but do not yet cover event hygiene, editable text
layers, browser E2E, or byte-bounded canvas memory.

## Installed external skills

The requested skills are installed under `paint/.agents/skills` and exposed
through symlinks in `paint/.claude/skills`:

1. **web-quality-audit** — tailored to Paint's local shell/editor journeys,
   browser memory, pointer work, Ribbon layouts, and release evidence.
2. **accessibility** — tailored to Paint's native controls, dialogs, menus,
   tabs, canvas alternatives, history, palette, text, focus, and reduced motion.
3. **playwright** — tailored to the repository's local Playwright CLI workflow,
   artifact directory, and Paint-specific smoke journeys.

Irrelevant generic guidance was removed from the canonical files and their
supporting references; the `.claude/skills` symlinks were preserved. Legal and
metadata files remain intact.

1. **web-quality-audit** — [skills.sh listing](https://www.skills.sh/addyosmani/web-quality-skills/web-quality-audit)
2. **accessibility** — [skills.sh listing](https://www.skills.sh/addyosmani/web-quality-skills/accessibility)
3. **Playwright CLI Skill** — [skills.sh listing](https://www.skills.sh/openai/skills/playwright)

## Recommendation

Use the installed skills during Steps 10–11 and browser verification as their
Paint-tailored workflows require. Do not install overlapping Playwright skills
or animation libraries for this mission. Keep event hygiene, text-layer
contracts, and canvas-memory budgets project-owned.
