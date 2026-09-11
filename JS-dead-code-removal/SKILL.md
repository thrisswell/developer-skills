---
name: js-dead-code-removal
description: Use this skill whenever the user wants to remove dead code, unused code, or irrelevant code from JavaScript/TypeScript (.js, .jsx, .ts, .tsx) files — for example "remove dead code", "clean up this file", "delete unused imports/functions/variables", "reduce lines of code", "trim this module", or "find what's not used". Also use it when shrinking a file's line count without breaking behavior, or when a SAST/Cycode finding points at unreachable or unused code. The skill removes provably-unused code while preserving behavior AND hardens the surviving code against the top OWASP/SAST violations (XSS sinks, hardcoded secrets, weak randomness, observable timing discrepancies). Do NOT use it for general feature work, bug fixing unrelated to cleanup, or non-JS languages.
---

# JavaScript / TypeScript Dead Code Removal

This skill removes code that is **provably unused** from a JS/TS file (or set of files) so the line count drops, while guaranteeing two things the user cares about:

1. **No feature breaks.** Only remove code you can prove is unreferenced. When proof is impossible, flag it instead of deleting.
2. **SAST/Cycode friendly.** The surviving code must not introduce or leave behind the major OWASP/SAST violations (XSS, hardcoded secrets, weak randomness, timing leaks).

The cardinal rule: **deletion must be evidence-based, never vibe-based.** A line that "looks unused" but is wired up via a string key, dynamic import, framework convention, or reflection is NOT dead. Removing it is the failure mode this skill exists to prevent.

---

## Workflow

Follow these steps in order. Don't skip the analysis steps — that's where features get broken.

### Step 0 — Establish a safety net

Before deleting anything:

- Confirm the file is under version control (`git status`). If not, tell the user and recommend a commit/branch first. Cleanup without an undo path is reckless.
- Identify how to verify behavior: an existing test suite, type-check (`tsc --noEmit`), lint, or a build. Note the command(s). You'll run them after the edit to prove nothing broke.
- Establish whether the file is a **leaf** (nothing imports from it that you can't see) or part of a larger graph. A single uploaded file viewed in isolation is dangerous — its exports may be consumed by files you can't see. Ask the user about the project scope if it's unclear.

### Step 1 — Run automated detection (don't trust your eyes alone)

Static analysis tools are more reliable than manual reading for the easy 80%. Prefer them. See `references/tooling.md` for setup and exact commands. The fast path:

```bash
# Unused exports, files, and dependencies across a project (best signal)
npx knip

# Per-file unused vars/imports (ESLint, no config needed for a one-off)
npx eslint --no-eslintrc \
  --parser-options ecmaVersion:latest,sourceType:module \
  --rule '{"no-unused-vars":"error","no-unreachable":"error"}' <file>

# TypeScript: surface unused locals/params
# add "noUnusedLocals": true, "noUnusedParameters": true to tsconfig, then:
npx tsc --noEmit
```

Use the tool output as your candidate list. Then apply Step 2 judgment to each candidate before deleting.

### Step 2 — Classify each candidate (DELETE / KEEP / FLAG)

For every candidate the tools (or your reading) surface, classify it. **Only the DELETE bucket gets removed.**

**Safe to DELETE** (remove these):

- Imports with zero references in the file.
- Local variables/functions that are declared, never read, and have no side effects in their initializer.
- Code after an unconditional `return`/`throw`/`break`/`continue` (unreachable).
- `if (false)` / `if (true)`-guarded dead branches with literal constant conditions.
- Commented-out code blocks (version control is the archive, not comments).
- Private class members with no internal references.
- Exports that `knip` confirms are unused **across the whole project** (not just the current file).

**Must KEEP** (never remove, even if tools flag them):

- Anything referenced dynamically: `obj[someStringKey]`, `import(variable)`, `require(variable)`.
- Framework/convention entry points: React components used in JSX/routes, Vue SFC exports, Next.js `getServerSideProps`/`generateMetadata`/route handlers, lifecycle hooks, event handlers wired by name.
- Public API surface of a library/package (exports consumed by external callers you can't see).
- Code with side effects in its initializer (a "variable" whose right-hand side calls a function that registers something, mutates global state, sets up a listener, etc.).
- Things touched by reflection, decorators, DI containers, or config-driven wiring.
- `default` exports and named exports of a file whose consumers aren't in scope of your analysis.

**FLAG, don't delete** (surface to the user, let them decide):

- An export that _appears_ unused but you can't see the whole import graph.
- A function only referenced in tests, or only via a string.
- Anything where you'd be guessing. Guessing is how features break — list it instead.

### Step 3 — Remove, smallest blast radius first

- Edit the actual file with precise replacements. Don't rewrite the whole file from memory — that risks silent drops and reformatting noise.
- Remove dead imports first, then unreachable blocks, then unused locals, then (cautiously, project-scoped) unused exports.
- After removing a symbol, **check for cascade**: did removing it make something else unused (an import only used by the deleted function, a helper only called from the deleted branch)? Re-scan and repeat until stable.
- Preserve formatting and style of surrounding code. Don't reflow untouched lines.
- Keep comments that explain _why_ (intent, caveats, links). Only delete commented-out _code_.

### Step 4 — Security pass on the SURVIVING code (mandatory)

Dead-code removal changes a file, so it's the moment to make sure what remains is SAST/Cycode-clean. Walk `references/security-checklist.md` against the surviving code and fix any of the top OWASP/SAST issues you find. The four the user explicitly flagged, summarized:

- **XSS / unsafe sinks** — `innerHTML`, `outerHTML`, `document.write`, `dangerouslySetInnerHTML`, `eval`, `new Function`, jQuery `.html()`. Sanitize with DOMPurify or switch to safe sinks (`textContent`, `setAttribute`, parameterized framework rendering). Fix the sink; don't just suppress the finding.
- **Hardcoded values / secrets** — API keys, tokens, passwords, connection strings, private URLs literal in source. Move to environment/config; never commit. Cycode and Semgrep both flag these hard.
- **Lack of secure randomness** — `Math.random()` used for tokens, IDs, nonces, salts, OTPs, anything security-relevant. Replace with `crypto.getRandomValues()` (browser) or `crypto.randomBytes`/`crypto.randomUUID()` (Node). `Math.random()` is fine ONLY for non-security cosmetic randomness.
- **Observable timing discrepancy** — comparing secrets/tokens/HMACs/passwords with `===`, `==`, or `indexOf`. Use a constant-time compare (`crypto.timingSafeEqual` in Node).

Do not introduce any of these while editing, and fix the ones you can fix safely without changing intended behavior. If a fix would alter behavior, FLAG it for the user rather than silently changing semantics.

### Step 5 — Verify and report

- Run the verification command(s) from Step 0 (tests / `tsc --noEmit` / lint / build). If anything fails, the deletion was wrong — revert that specific removal.
- Report concisely:
  - **Removed:** what and why (e.g. "`formatLegacy` — unreachable after early return; 14 lines").
  - **Lines saved:** before → after.
  - **Security fixes applied:** each one, with the violation class.
  - **Flagged (your call):** the KEEP-but-suspicious and FLAG items, so the user can decide on the ambiguous ones.

---

## Hard rules

- **Never delete to hit a line-count target.** The goal is removing _unused_ code, not the smallest possible file. Shrinking by deleting used code is a regression, not a win.
- **When in doubt, flag — don't delete.** A flagged false positive costs the user 10 seconds; a deleted live function costs a production incident.
- **Fix root causes, not findings.** When addressing a SAST issue, fix the actual sink/secret/comparison. Suppression comments (`// eslint-disable`, `// nosemgrep`) are a last resort and must be justified to the user, not used to make a tool quiet.
- **Don't reformat untouched code.** Keep the diff to what actually changed so review is easy and behavior stays intact.

## Reference files

- `references/tooling.md` — Install/run commands and tuning for knip, ts-prune, ESLint, depcheck, and how to read their output (including false-positive patterns).
- `references/security-checklist.md` — The full OWASP/SAST checklist with before→after fix patterns for XSS, secrets, randomness, timing, plus prototype pollution, ReDoS, open redirect, and command/path injection.
