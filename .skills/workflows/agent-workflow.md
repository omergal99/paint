# Agent workflow

Use for multi-step implementation, planning, audit, or research. Follow
`AGENTS.md` and load only the project guides and Agent Skills relevant to the
task.

## Plan and gather evidence

- Define the goal, in/out of scope, acceptance evidence, and stop condition.
- Use focused file reads, searches, Git, and deterministic checks before
  model-based synthesis. Distinguish source facts, tests, browser evidence, and
  hypotheses.
- Budget context by phase. Stop to narrow or summarize if evidence or scope
  grows beyond the original goal.
- Use sub-agents only for independent work that benefits from separate context;
  never delegate a continuous trace or duplicate direct review.

## Change and verify

- Make a coherent, surgical change. Preserve unrelated work and existing data.
- Keep logic, persisted data, and UI rendering separate; reuse existing
  components and single sources of truth.
- Run the smallest covering checks, then expand for meaningful risk. Report
  exact commands and results; separate browser/device evidence from source-only
  checks.
- Respect human approval for destructive Git operations, publishing, licensing,
  credentials, broad migrations, and other consequential decisions.

## Handoff and maintenance

- Update the canonical project documentation directly related to the change.
- At session end, use the `maintenance` Agent Skill to record relevant skill
  usage and a concise, evidence-based retro.
- Never infer historical skill usage when invocation records are unavailable.
  Do not auto-delete or rewrite skills from a single subjective rating.

## Copy-paste prompt

```text
Use the repository workflow:
1. Read AGENTS.md and only relevant project guides/skills.
2. State scope, acceptance evidence, and stop condition.
3. Gather focused deterministic evidence before implementation.
4. Make a coherent, surgical change and run the smallest covering checks.
5. Report exact results, limitations, and any human approval still needed.
6. At handoff, follow the maintenance skill and record skill usage honestly.
```
