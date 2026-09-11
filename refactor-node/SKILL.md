---
description: Apply when writing or generating Node.js backend code — Express/Fastify/NestJS middleware and services that connect to Postgres or MongoDB and serve a React frontend. Produces production-ready code (not MVP or POC) with industry-standard defaults and a no-brainer security baseline: schema-validated inputs, parameterized queries, no hardcoded secrets, proper CORS, HTTP security headers, structured logging, timeouts, and rate limits. Use this skill on every Node backend generation task even if the user doesn't explicitly say "production-ready" or "secure" — those are the defaults this skill enforces. Scope is deliberately bounded: this skill does NOT cover authorization model design, performance tuning, frontend code, CLI tools, or library publishing.
---

# Must do:

- Follow all the security principles as stated in cybersecurity guidelines for the project.
- Ensure proper error handling is in place.

# Node.js Backend Best Practices

This skill is scoped to one job: generating production-ready Node.js backend code — middleware, HTTP APIs, and background workers — that connects to Postgres or MongoDB and serves a React frontend.

## Scope

**In scope:**

- TypeScript backend services on Express, Fastify, or NestJS.
- Postgres and MongoDB data access.
- HTTP APIs consumed by a React frontend (CORS, cookies, JSON contract).
- The no-brainer security baseline — OWASP categories that are pattern-matchable at code-generation time.
- Industry-standard defaults: lockfiles, structured logging, schema validation, proper error handling.

**Explicitly out of scope:**

- Authorization model design (RBAC/ABAC — that's a per-service threat-modeling exercise).
- Performance tuning beyond "don't block the event loop, set timeouts, cap sizes."
- Frontend code, CLI tools, library publishing.
- DAST findings — those require a running deployment.

If the user asks for something out of scope, help them, but don't claim it falls under "production-ready Node backend."

---

## Production-ready defaults

### Language and tooling

- **TypeScript with `strict: true`** and `noUncheckedIndexedAccess: true`. No `any` — use `unknown` and narrow.
- **ESM** (`"type": "module"`) for new code.
- **Node LTS only**, pinned via `.nvmrc` and `engines` in `package.json`.
- **ESLint** with `@typescript-eslint`, `eslint-plugin-security`, `eslint-plugin-n`, `eslint-plugin-promise`. Plus **Prettier**.
- **Lockfile committed.** Install in CI with `npm ci` / `pnpm install --frozen-lockfile`.

### Project structure

```
src/
├── index.ts        ← bootstrap only
├── config.ts       ← env var validation at startup
├── routes/         ← HTTP transport, thin (~20 lines per handler)
├── services/       ← business logic
├── db/             ← data access (queries, models)
├── schemas/        ← zod schemas (shared with frontend where possible)
└── lib/            ← cross-cutting helpers
```

Handlers do three things: validate input, call a service, return a response. Business logic does not live in route files.

### Configuration

**Validate environment variables at startup, before the server starts listening.** Crash loudly on misconfiguration:

```ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
});

export const env = envSchema.parse(process.env);
```

**No hardcoded secrets, ever.** Use env vars (or a secret manager) — including in tests, via a gitignored `.env.test`. Add `gitleaks` to pre-commit.

### Error handling

- **Every async call has a handling strategy.** Either `await` inside `try/catch`, return the promise to a caller that handles it, or `.catch()` it. Enable `@typescript-eslint/no-floating-promises`.
- **Throw `Error` subclasses, not strings.** Define domain errors (`NotFoundError`, `ValidationError`, `ConflictError`) that map cleanly to HTTP status codes.
- **One central error handler per service** — converts thrown errors to HTTP responses. Never returns stack traces or internal messages to clients.

```ts
app.use((err, req, res, next) => {
  req.log.error({ err }, "request failed");
  if (err instanceof ValidationError)
    return res.status(400).json({ error: err.message });
  if (err instanceof NotFoundError)
    return res.status(404).json({ error: err.message });
  return res.status(500).json({ error: "Internal server error" });
});
```

- **Crash on `unhandledRejection` / `uncaughtException`.** Log and exit; let the process manager restart you. A Node process in an unknown state should not keep serving traffic.

### Logging

- **`pino`** with `pino-http` for request logs. Structured JSON — no `console.log` in production code paths.
- **Redact sensitive fields**:

```ts
const logger = pino({
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "*.password",
    "*.token",
  ],
});
```

- **Request ID on every log line** (`pino-http` and Fastify do this by default).

### Async patterns

- **`async/await` over `.then` chains.**
- **`Promise.all`** for parallel work, **`Promise.allSettled`** when partial failure is acceptable.
- **`for...of` with `await` is serial** — use it only when serial execution is intentional.

---

## Input validation — the highest-leverage rule

**Validate every input crossing a trust boundary with a schema.** HTTP request bodies, query strings, route params, headers you read, queue messages, external API responses. No exceptions.

Use **`zod`** (most common) or **`valibot`** (smaller bundle). Both produce a parsed, typed value and reject everything else.

```ts
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(13).max(120),
});

app.post("/users", async (req, res) => {
  const body = CreateUserSchema.parse(req.body); // throws ZodError on invalid input
  const user = await userService.create(body);
  res.status(201).json(user);
});
```

Why this matters specifically for your stack:

- **Prevents prototype pollution** — schemas reject `__proto__` and `constructor` keys before they reach your code.
- **Prevents NoSQL injection on Mongo** — declaring `email: z.string()` rejects an attacker's `email[$ne]=` payload before it reaches the query.
- **Prevents type confusion** — Express gives you `req.body.x` as `any`; zod gives you the real type or throws.
- **Single source of truth with React** — export the schemas to your frontend or generate them into OpenAPI (`@asteasolutions/zod-to-openapi`).

---

## Database access

### Postgres

- **Always parameterize.** Never template user input into SQL:

```ts
// Bad — SQL injection
db.query(`SELECT * FROM users WHERE email = '${email}'`);

// Good — placeholders
db.query("SELECT * FROM users WHERE email = $1", [email]);
```

- **Use a type-safe query builder or ORM**: **Prisma**, **Drizzle**, or **Kysely**. Pick one.
- **ORM escape hatches reintroduce injection.** `prisma.$queryRawUnsafe`, `knex.raw` with interpolation — don't use these with user input. Prefer the tagged-template versions (`` prisma.$queryRaw`SELECT ... ${value}` ``) which parameterize automatically.
- **Use a connection pool** (`pg.Pool` or the ORM's built-in). Don't open per-request connections.
- **Set a statement timeout** so a runaway query can't hold a pool connection forever:

```ts
new Pool({ connectionString: env.DATABASE_URL, statement_timeout: 10_000 });
```

- **Migrations**, not ad-hoc DDL. Use the ORM's migration tool or `node-pg-migrate`.

### MongoDB

- **Validate query inputs with zod before they reach the driver.** This is how you prevent operator injection:

```ts
// Bad — operator injection via ?username[$ne]=
User.findOne({ username: req.query.username });

// Good — zod rejects non-string input
const { username } = z.object({ username: z.string() }).parse(req.query);
User.findOne({ username });
```

- **Mongoose schemas with `strict: true`** (the default) — unknown fields get dropped. Never `strict: false`.
- **Declare indexes explicitly** in schemas. Production queries against unindexed fields will silently degrade until they don't.
- **Set query timeouts** with `.maxTimeMS()` on anything that could be slow.
- **Never construct operator names from user input.** If users need to filter by field name, validate against an allowlist.

---

## HTTP API specifics (serving a React frontend)

### Security headers

- **Use `helmet`** (Express) or **`@fastify/helmet`**. Accept the defaults unless you have a reason to change them.
- For pure JSON APIs, the default CSP is usually fine. If you also serve HTML, configure CSP deliberately.

### CORS

- **Explicit origin allowlist.** Never `origin: "*"` with credentials in production.

```ts
app.use(
  cors({
    origin: ["https://app.example.com", "https://staging.example.com"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
```

### Body parsing limits

```ts
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ limit: "100kb", extended: false }));
```

For file uploads, set explicit caps on size, file count, and field count via `multer` / `@fastify/multipart` options. Default-unlimited body parsers are a DoS vector.

### Rate limiting

- **`express-rate-limit`** or **`@fastify/rate-limit`** on public endpoints. Stricter limits on auth routes (login, signup, password reset).
- For multi-instance deployments, back the limiter with Redis so limits are shared across replicas.

### Cookies and sessions

- Session cookies: `Secure`, `HttpOnly`, `SameSite=Lax` (or `Strict` if no cross-site flows are needed).
- If your React SPA lives on a different domain from the API, you need `SameSite=None; Secure` plus correct CORS. Be deliberate about it — don't copy-paste from a blog post.

### Authentication

- **Hash passwords with `argon2` or `bcrypt`.** Never plain SHA/MD5.
- **JWT**: pin the algorithm explicitly (`{ algorithms: ["RS256"] }` or `["HS256"]`). Never accept `none`. Prefer **`jose`** over older `jsonwebtoken` patterns.
- **Use a vetted auth library** — Lucia, better-auth, Auth.js, Clerk, Auth0. Don't hand-roll JWT verification.

### Outbound HTTP

- **Always set a timeout.** `fetch` and `undici` have no default; a hung dependency takes your service down with it.

```ts
await fetch(url, { signal: AbortSignal.timeout(5000) });
```

- **Reuse agents** (`undici.Agent`, or a keep-alive `http.Agent`) on hot paths.
- **If the URL comes from a user**, validate against a domain allowlist and block private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.169.254`) — SSRF defense.

### Response handling

- **Never include stack traces or raw error messages in responses.** The central error handler maps known errors to safe messages; everything else is a generic `500`.
- **Set `Content-Type: application/json` explicitly** for JSON.
- **Don't return raw database errors to clients.** Map them to domain errors first.

---

## No-brainer security baseline

These are the patterns this skill commits to catching at generation time. Code produced under this skill should not contain any of these:

1. **Hardcoded secrets** in source → env vars, validated at startup.
2. **String interpolation into SQL** → parameterized queries.
3. **Unvalidated user input passed to Mongo queries** → zod first.
4. **`eval`, `new Function`, `vm.runInNewContext` on user input** → don't.
5. **Dynamic `require()` / `import()` with user input** → don't.
6. **`child_process.exec(...)` with user input, or `spawn` with `shell: true`** → `spawn`/`execFile` with args array.
7. **`Math.random()` for tokens, IDs, or secrets** → `crypto.randomBytes` / `crypto.randomUUID`.
8. **`rejectUnauthorized: false` or `NODE_TLS_REJECT_UNAUTHORIZED=0`** → use proper certs.
9. **JWT `none` algorithm, or unpinned algorithm** → pin it.
10. **Plain SHA/MD5 for passwords** → argon2 or bcrypt.
11. **`Object.assign` / spread / deep-merge on unvalidated input** → validate with zod first (prototype pollution).
12. **CORS `origin: "*"` with `credentials: true`** → explicit allowlist.
13. **`fetch` / `undici` without a timeout** → `AbortSignal.timeout(...)`.
14. **Unlimited body parsers, unlimited file uploads** → explicit limits.
15. **Empty `.catch(() => {})` swallowing errors** → log and decide deliberately.
16. **Returning stack traces or raw errors to clients** → central error handler.
17. **Floating promises** → `await`, `.catch()`, or return.
18. **Path joining user input without containment check** → resolve and verify `startsWith(base + sep)`.
19. **Logging secrets, tokens, or full request bodies** → configure logger redaction.
20. **`any` types on data crossing a trust boundary** → zod-parsed types.

---

## Required CI gates

For this skill's promise to hold over time, the generated code must ship alongside these gates. The skill is necessary but not sufficient on its own.

| Check           | Tool                              | Blocks merge on |
| --------------- | --------------------------------- | --------------- |
| Lint            | `eslint` with security plugins    | Any error       |
| Type check      | `tsc --noEmit`                    | Any error       |
| Tests           | `vitest` / `jest` / `node --test` | Any failure     |
| Dependency CVEs | `npm audit --audit-level=high`    | High/critical   |
| Secret scanning | `gitleaks`                        | Any finding     |

Run them on every PR. Without them, the guarantees erode as the code evolves.

---

If code is generated following these rules and the CI gates above are in place, it will pass ESLint with security rules, `npm audit`, and a default Semgrep ruleset on first push, and will not contain the no-brainer security loopholes listed above. That is the bounded promise of this skill — no more, no less.
