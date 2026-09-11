# OWASP / SAST security checklist for surviving JS/TS code

Apply this to the code that remains after dead-code removal. Goal: the file passes Cycode/Semgrep/CodeQL/SonarQube clean on the major violation classes. Always **fix the root cause** — suppression comments are a justified-last-resort, not a default. If a real fix would change intended behavior, FLAG it for the user instead of silently changing semantics.

## 1. XSS / unsafe DOM & code-exec sinks (OWASP A03 Injection)

Dangerous sinks: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `document.writeln`, jQuery `.html()`/`.append(htmlString)`, React `dangerouslySetInnerHTML`, `eval`, `new Function`, `setTimeout`/`setInterval` with a string argument.

Fix patterns:

```js
// ❌ el.innerHTML = userInput;
// ✅ text only:
el.textContent = userInput;
// ✅ must render HTML → sanitize:
import DOMPurify from "dompurify";
el.innerHTML = DOMPurify.sanitize(userInput);
```

```jsx
// ❌ <div dangerouslySetInnerHTML={{ __html: userHtml }} />
// ✅
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userHtml) }} />
// ✅ better, if no HTML needed: <div>{userHtml}</div>
```

```js
// ❌ eval(code);  /  new Function(code);  /  setTimeout("doThing()", 100);
// ✅ call the function directly; use JSON.parse for data; pass a function ref to setTimeout
setTimeout(() => doThing(), 100);
```

Never build a sink suppression. If a sink is genuinely required (a rich-text editor), it must go through DOMPurify with an explicit, reviewed allowlist config.

## 2. Hardcoded values / secrets (OWASP A07 / A05)

Flagged: API keys, tokens, passwords, private keys, DB connection strings, secret URLs, JWT secrets literal in source.

```js
// ❌ const API_KEY = "sk_live_a1b2c3...";
// ✅ read from environment / secret manager
const API_KEY = process.env.API_KEY; // Node
const API_KEY = import.meta.env.VITE_API_KEY; // Vite (note: build-time public — only for non-secret config)
if (!API_KEY) throw new Error("API_KEY is not set");
```

Notes:

- Truly secret values must never reach client-side bundles. If a "secret" is needed in the browser, the architecture is wrong — flag it; the call belongs on a server/proxy.
- A committed secret is considered compromised even after removal — tell the user to rotate it.
- Non-secret literals (config defaults, enum values, magic numbers) are fine; SAST flags _credentials_, not all constants. Don't over-react and externalize harmless constants.

## 3. Insecure randomness (OWASP A02 Cryptographic Failures)

`Math.random()` is not cryptographically secure. Forbidden for tokens, session IDs, password-reset/OTP codes, nonces, salts, IVs, CSRF tokens, anything security-relevant.

```js
// ❌ const token = Math.random().toString(36).slice(2);

// ✅ Node:
import { randomBytes, randomUUID } from "node:crypto";
const token = randomBytes(32).toString("hex");
const id = randomUUID();

// ✅ Browser:
const buf = new Uint8Array(32);
crypto.getRandomValues(buf);
const token = [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
const id = crypto.randomUUID();
```

`Math.random()` is acceptable only for non-security uses (animation jitter, shuffling display order, sampling). Leave those alone.

## 4. Observable timing discrepancy (OWASP A02)

Comparing secrets with `===`/`==`/`!=`/`indexOf`/`startsWith` leaks length/prefix info via timing, enabling side-channel attacks.

```js
// ❌ if (providedToken === storedToken) { ... }

// ✅ Node — constant-time:
import { timingSafeEqual } from "node:crypto";
function safeEqual(a, b) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false; // length check is unavoidable; hash first if length is sensitive
  return timingSafeEqual(ab, bb);
}
if (safeEqual(providedToken, storedToken)) { ... }
```

For HMAC/signature verification, prefer hashing both sides to equal length first, then `timingSafeEqual`, so length isn't itself a leak. In the browser there's no built-in constant-time compare — do credential comparison server-side.

## 5. Quick scan for other common SAST flags

While you're in the file, check these too — they're frequent Cycode/Semgrep findings:

- **Prototype pollution** — recursive merge / `obj[key] = val` from user input. Reject `__proto__`, `constructor`, `prototype` keys; use `Map` or `Object.create(null)`.
- **ReDoS** — regexes with nested quantifiers like `(a+)+`, `(.*)*`. Simplify the pattern or bound input length.
- **Open redirect** — `location.href = userInput` / `res.redirect(userInput)`. Validate against an allowlist of paths/hosts.
- **Command/path injection (Node)** — `child_process.exec(userInput)` → use `execFile`/`spawn` with an args array; `fs` paths from user input → resolve and confirm they stay within an allowed base dir.
- **Insecure URL / TLS** — `http://` for sensitive calls, `rejectUnauthorized: false`. Use `https`, don't disable cert validation.
- **Missing CSRF/cookie flags (Node servers)** — cookies without `httpOnly`/`secure`/`sameSite`.

## Verification

After security fixes, re-run the project's SAST/lint/type-check and the test suite. A fix that breaks a test means it changed behavior — revisit it. Report each fix by its violation class so the user sees the security delta, not just the line-count delta.
