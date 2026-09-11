# Dead-code detection tooling

Use tools for the bulk of detection — they're more reliable than reading. Then apply human judgment (SKILL.md Step 2) to each candidate, because every tool produces false positives on dynamically-referenced code.

## knip — best project-wide signal (preferred)

Finds unused files, exports, exported types, and dependencies across the whole repo. This is the only tool here that reliably catches **unused exports**, because it resolves the full import graph.

```bash
npx knip                 # report
npx knip --include files,exports,dependencies
npx knip --fix           # auto-remove (review the diff carefully before committing)
```

Reading the output: an export listed under "Unused exports" is a strong DELETE candidate _only if_ knip sees the whole graph. If the file is a published package entry point, a framework convention (route, page, loader), or consumed by code outside the analyzed project, knip will wrongly flag it → KEEP/FLAG. Configure entry points in `knip.json` to suppress those:

```json
{
  "entry": ["src/index.ts", "src/pages/**/*.tsx"],
  "project": ["src/**/*.{ts,tsx}"]
}
```

## ESLint — best per-file signal for unused vars/imports + unreachable

No project config needed for a one-off:

```bash
npx eslint --no-eslintrc \
  --parser-options ecmaVersion:latest,sourceType:module \
  --rule '{"no-unused-vars":"error","no-unreachable":"error","no-constant-condition":"error"}' \
  path/to/file.js
```

For TS files, add the TS parser/plugin:

```bash
npx eslint path/to/file.ts \
  --parser @typescript-eslint/parser \
  --plugin @typescript-eslint \
  --rule '{"@typescript-eslint/no-unused-vars":"error","no-unreachable":"error"}'
```

`no-unused-vars` catches dead imports and locals. `no-unreachable` catches code after `return`/`throw`. `no-constant-condition` catches `if(false)` dead branches. To auto-strip unused imports specifically, `eslint-plugin-unused-imports` has a `--fix`-able rule.

## TypeScript compiler — unused locals/params

In `tsconfig.json`:

```json
{ "compilerOptions": { "noUnusedLocals": true, "noUnusedParameters": true } }
```

Then `npx tsc --noEmit`. Bonus: `tsc --noEmit` is also your **behavior-verification** step after editing — if removal broke a type reference, it fails here.

## ts-prune — unused exports (TS-only, lighter than knip)

```bash
npx ts-prune
```

Lines marked `(used in module)` are referenced internally — KEEP. Plain lines are unused-export candidates. Same caveat as knip re: framework entry points.

## depcheck — unused dependencies

```bash
npx depcheck
```

Surfaces `package.json` deps with no imports. Verify before removing — some deps are used by build tooling, config files, or only at runtime via plugin resolution, which depcheck misses.

## Recommended order for a typical request

1. `knip` (or `ts-prune` + `depcheck`) for the project-wide picture.
2. ESLint / `tsc --noEmit` for per-file precision on the target file(s).
3. Cross-reference: a symbol flagged by _both_ a project tool and a file tool, with no dynamic-reference pattern, is a high-confidence DELETE.

## Universal false-positive patterns (tools miss these → KEEP)

- `obj["methodName"]()` or `obj[key]()` — string/dynamic dispatch.
- `import(path)` / `require(name)` with a non-literal argument.
- Symbols referenced only in template strings, JSX, or `.html`/framework templates the tool didn't parse.
- Exports consumed by tests, stories, or build scripts outside the analyzed `project` glob.
- Decorator/DI-registered classes, framework lifecycle methods, event handlers wired by string name.
- Anything re-exported via `export * from`.
