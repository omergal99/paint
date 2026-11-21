# Token and context efficiency

Use this guide with the broader [agent workflow](agent-workflow.md). Efficiency
means avoiding unnecessary work, not omitting required reasoning or evidence.

- Set a bounded objective and a stop condition before substantial work.
- Gather facts deterministically first; read the smallest relevant file ranges
  and share only the output needed to decide.
- Reuse already-read context, avoid repeated searches, and do not dump full
  logs, directories, or diffs when a focused query is enough.
- Prefer one coherent patch and the smallest test set that covers the change;
  expand validation when results or risk require it.
- Use sub-agents only for independent responsibilities with clear value; do not
  duplicate a direct investigation.
- Use caching or lower-cost models only when supported and appropriate. Never
  trade away correctness, privacy, accessibility, user-facing clarity, or
  required human approval to save tokens.
- Report exact checks and meaningful limitations concisely. Keep explanations
  proportional to the task rather than enforcing a fixed response template.
