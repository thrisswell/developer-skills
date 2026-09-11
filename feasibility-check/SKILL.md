---
name: feasibility-check
description: >
  Run a technical feasibility and implementation possibility check on an idea or approach the user is considering.
  Use this skill whenever the user asks things like "is it possible to...", "can we...", "would it work if...",
  "is it feasible to...", "what do you think about doing X", "could I...", "is there a way to...",
  "before I start, can you check...", or any phrasing where they want a reality check on a technical idea
  BEFORE committing to building it. This skill does NOT write code, modify files, or make any changes —
  it only evaluates and reports. Trigger it even if the idea sounds straightforward; the user wants
  deliberate analysis, not just a quick "yes". Also trigger when a user proposes an architectural change,
  integration approach, refactoring strategy, or tool/library substitution and wants to know if it will work.
---

# Feasibility Check

A read-only analysis skill. **No code is written. No files are modified. No changes are made.**

The goal is to give the user an honest, grounded assessment of whether a technical idea is viable — covering what will work, what won't, and what the real risks are — so they can decide whether to proceed before investing any effort.

---

## Behaviour Rules

1. **Read-only mode, always.** Do not write, edit, delete, or suggest creating any file or code during this skill. If the user asks for code as part of the check, acknowledge it and defer it: "That's out of scope for the feasibility check — once you decide to proceed, we can build it."
2. **Be direct, not diplomatic.** If something is a bad idea, say so clearly with reasons. Optimism bias wastes the user's time.
3. **Stay scoped to the idea.** Don't expand into adjacent improvements or refactoring suggestions unless they directly bear on feasibility.
4. **Distinguish certainty levels.** Clearly separate what you know for certain from what requires validation or a spike.

---

## Analysis Process

### 1. Restate the Idea

In one or two sentences, confirm your understanding of what the user is proposing. If it's ambiguous, ask a single clarifying question before proceeding.

### 2. Feasibility Verdict

Open with a clear verdict in plain language:

- ✅ **Feasible** — works as described, no significant blockers
- ⚠️ **Feasible with caveats** — works, but with meaningful constraints or trade-offs
- ❌ **Not feasible as described** — a fundamental blocker exists; pivot or redesign needed

### 3. Technical Analysis

Cover the relevant dimensions from this list (skip dimensions that genuinely don't apply):

- **Architecture fit** — does it align with the existing stack, patterns, and constraints?
- **Dependencies / libraries** — does the required tooling exist, is it production-ready, and are there licensing or version conflicts?
- **Integration points** — APIs, services, protocols, auth — any known friction or limitations?
- **Data / state** — schema changes, migration needs, data volume considerations
- **Performance** — latency, throughput, memory, or scaling concerns that could break the approach
- **Security** — obvious attack surface or compliance issues introduced by this approach
- **Deployment / ops** — infra changes, pipeline impact, environment-specific constraints
- **Effort estimate** — rough complexity signal: Low / Medium / High / Very High (with a one-line rationale)

### 4. Blockers vs. Risks

Separate hard blockers (things that will definitely fail) from risks (things that might cause problems). Be explicit about which is which.

| Type    | Item | Severity            |
| ------- | ---- | ------------------- |
| Blocker | ...  | Critical            |
| Risk    | ...  | High / Medium / Low |

Skip this table if there are no material blockers or risks.

### 5. Recommended Path Forward

End with a concrete recommendation — one of:

- **Proceed** — go ahead as described
- **Proceed with adjustments** — list the specific changes needed first
- **Spike first** — identify the one unknown that must be validated before committing
- **Don't proceed** — explain the better alternative

Do not offer vague encouragement. Make a call.

---

## Tone and Format

- Keep the response tight. Avoid restating things the user already knows.
- Use tables and bullet points to make trade-offs scannable.
- Calibrate depth to the complexity of the idea — a simple library swap doesn't need a full table; a cross-service architectural change does.
- If the codebase or context hasn't been shared and is needed for an accurate assessment, say so explicitly and ask for the relevant files or context rather than guessing.
