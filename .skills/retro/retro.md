---
name: retro
version: 3.0.0
trigger: "/retro"
description: >
  A universal, self-evolving retrospective and optimization engine for any AI agent.
  Analyzes current session context across all perspectives (User, Agent, Ecosystem, and Blindspots),
  executes 360° feedback loops, auto-generates reusable skills/plugins, and updates its own implementation.
domain: Universal (Software Engineering, Architecture, Research, Product, and General Workflows)
---

# `/retro`: Universal Session Retrospective and Self-Evolving Engine

## 1. Core Philosophy and Multi-Perspective Hats
Whenever /retro is called, the agent must inspect the session from 4 distinct perspectives to uncover hidden value and blindspots:

👤 The User Performance Coach:

How can the user improve prompting efficiency, context delivery, or workflow handoffs?

What instructions were ambiguous, missing, or overly repetitive?

🤖 The Agent Self-Correction & Automation Hat:

Where did the agent fail, stall, or take sub-optimal paths during the session?

What manual steps taken by the agent in this session can be converted into automated scripts, reusable skills, or background workflows?

🛠️ The Domain & Ecosystem Audit Hat (e.g., Software, SDLC, Data, Product):

What external tools, 3rd-party integrations, environment variables, dependencies, or process bottlenecks affected the session?

Note: Software Engineering/SDLC is a primary example, but this hat automatically adapts to whatever domain the session belongs to (e.g., build times, package cleanups, API latency, or content research flow).

🔮 The Future Visionary & Blindspot Detector:

What critical optimizations or unseen risks exist that neither the user nor agent explicitly noticed?

Search internet/ecosystems for new tools, libraries, or patterns that fit this exact workspace.

## 2. Directory and Memory Architecture
All learnings, metrics, and generated artifacts are indexed and persisted in the local workspace:

```text
docs-internal/
└── retro/
    ├── index.json                  # Master database of sessions, generated skills, and trends
    ├── skills/                     # Auto-generated reusable skill files created by /retro
    ├── plugins/                    # Custom automated scripts and tooling created by /retro
    ├── memory/
    │   ├── user_feedback.json      # Patterns on how the user can optimize their interaction
    │   ├── agent_learnings.json    # Agent anti-patterns, fix logs, and workflow shortcuts
    │   └── workspace_context.json  # Indexed workspace dynamics and third-party dependencies
    └── reports/                    # Output HTML reports generated after each retro run
  ```
## 3. Execution Pipeline

```mermaid
flowchart TD
    A[Trigger /retro] --> B[Phase 1: 360 Context & External Investigation]
    B --> C[Phase 2: Cross-Perspective Analysis & Blindspot Discovery]
    C --> D[Phase 3: Interactive Action Plan & UI Selection]
    D --> E[Phase 4: Implementation, Skill Generation & Self-Update]
    E --> F[Phase 5: Dynamic Light-Theme HTML Report Generation]
  ```

  ### Phase 1: 360° Investigation and Context Expansion
Spawn sub-agents to analyze the complete operational footprint of the session:

**Session Telemetry Sub-Agent**

Inspect prompt history, user corrections, agent failures, API responses, terminal logs, and modified files.

**Third-Party and Ecosystem Sub-Agent**

Audit external integrations (Docker, Git, CI/CD, cloud providers, third-party APIs, external tools used during the session).

Identify failures or inefficiencies originating outside the immediate chat context.

**Smart Web Research Sub-Agent**

Search the web for community tools, modern libraries, or agent skills that solve friction points identified in this session.

### Phase 2: Actionable Plan Generation and Interactive UI Selector
Group all findings into clear, checkable categories. Present an interactive selector UI to let the user review, select, or modify action items before execution.

```markdown
### 📋 Proposed Retrospective Action Plan
Please select the items you would like me to execute and implement:

#### 👤 User Workflow Coaching
- [x] **[Prompting Tip]** Provide initial error stack traces directly in the opening prompt to save 2 debugging turns.

#### 🤖 Agent Automation & Capabilities
- [x] **[Auto-Skill Creation]** Generate `/db-migrate-check` skill to automate repetitive schema validations seen in this session.

#### 🛠️ Ecosystem & Domain Optimizations (Context-Specific)
- [x] **[Dependency Cleanup]** Remove 3 unused npm packages detected during build logs (`moment`, `lodash`).
- [ ] **[Build Optimization]** Add caching layer to local Docker build step.

#### 🔮 Blindspots & Self-Evolution
- [x] **[Self-Improvement]** Upgrade `/retro` skill logic to better detect memory leaks in background CLI tasks.

*Reply with confirmed numbers/checkboxes or type "proceed" to execute.*
```

### Phase 3: Execution, Skill Generation, and Self-Update
Upon user confirmation:

Apply Code & Workflow Fixes: Implement all approved refactorings, package updates, or configuration tweaks.

Synthesize New Skills/Plugins:

Save newly created skills to docs-internal/retro/skills/ and update docs-internal/retro/index.json.

CRITICAL — Self-Improvement Protocol:

Analyze how /retro performed during this run.

Update docs-internal/retro/skills/retro.md (this file) with improved prompts, sharper detection rules, or better UX flows learned from this execution.

Persist Memory:

Save extracted patterns to docs-internal/retro/memory/ for long-term indexing.

### Phase 4: Dynamic Light-Theme HTML Report Generation
Generate a comprehensive, beautifully styled HTML report saved to docs-internal/retro/reports/retro-[YYYYMMDD-HHMMSS].html and display a summary in chat.

#### HTML Report Design and Formatting Guidelines
DO NOT use a static, rigid template. Be creative and adapt the visual presentation dynamically based on the session's specific learnings.

Color Palette Requirement: Strict White / Light Theme (#ffffff or soft light gray #f8fafc background, high-contrast dark text #0f172a, clear vibrant accent colors like blue #2563eb, emerald #10b981, and amber #d97706). Must be pleasant and easy to read.

Visual Components:

Mermaid.js Diagrams: Include workflow transformations, before/after architecture, or sequence charts.

Comparison Tables: Before vs. After metrics with clear ranking indicators (e.g., S-Tier, +40% Efficiency).

#### Required Report Structure
Executive Summary (Top / Immediate Read):

Concise bullet points summarizing the key bottom line, main learnings, and top achievements.

360° Retrospective Breakdown Sections:

Section A: User Coaching & Workflow Feedback

Section B: Agent Performance & Automation Actions

Section C: Domain & Ecosystem Deep-Dive (Software/SDLC/Process)

Section D: Uncovered Blindspots & Future Opportunities

Requirements for Every Section Item:

💡 Proposal: What should be changed or implemented.

💻 Concrete Examples: Code snippets, prompt examples, or configuration diffs.

📊 Proof & Evidence: Logs, build times, error counts, or benchmarks explaining why this is recommended.

📝 Clear Explanation: Contextual reasoning ensuring complete transparency.

## 4. Operating Rules and Constraints
User Gatekeeping: Never execute codebase changes, install packages, or delete files without user confirmation in Phase 2.

Light Theme Strictness: All generated HTML reports must adhere to a clean, light-colored palette for maximum readability.

Domain Agnostic Adaptability: While software engineering and SDLC are primary default targets, seamlessly adjust focus if the session involves writing, research, architecture, or general task management.

Continuous Evolution: The /retro skill must continuously refine itself after every run, ensuring the system gets smarter over time.
