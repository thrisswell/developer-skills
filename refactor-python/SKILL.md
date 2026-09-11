---
description: Python best practices. Apply when writing, reviewing, or refactoring Python code. Covers production-grade coding standards (PEP 8, type hints, project layout, testing, dependency management, error handling, logging) and security practices aligned with the OWASP Top 10 and findings from common SAST/DAST tools (Bandit, Semgrep, ruff S-rules, pip-audit, Snyk, OWASP ZAP). Use this skill whenever the user asks to write Python, review or refactor Python code, harden a Python service, fix a security finding, set up a Python project, or build anything involving Python — even if they don't say "best practices" or "secure" explicitly.
---

# Must do:

- Follow all the security principles as stated in cybersecurity guidelines for the project.
- Ensure proper error handling is in place.

# Python Best Practices

This skill encodes the rules a senior Python engineer applies by reflex on production code: clean style, strong typing, defensive error handling, and security-first defaults. Use it for new code and as a review checklist for existing code.

## How to use this skill

1. When writing new code, follow the **Code quality** rules from the start.
2. Before considering a task done, walk the **Security checklist** — most real-world Python vulnerabilities come from a small, repeatable set of mistakes.
3. When a SAST tool (Bandit, Semgrep, ruff `S` rules) flags an issue, find the fix pattern in the **Security checklist**.
4. When reviewing someone else's code, the **Code review pass** at the bottom gives a fast ordered scan.

---

## Code quality

### Style and formatting

- Follow **PEP 8**. Don't argue with the linter — run `ruff` (or `flake8` + `black`) and accept its output.
- Use `black` or `ruff format` for formatting. Pick one and run it on save and in CI.
- Line length: 88 (black default) or 100. Pick one, stick to it.
- Naming: `snake_case` for functions and variables, `PascalCase` for classes, `UPPER_SNAKE` for constants, `_leading_underscore` for module-internal names.

### Type hints

- Add type hints to every public function signature. Internal helpers can be skipped if obvious, but err toward annotating.
- Run `mypy --strict` or `pyright` in CI. Untyped code rots into runtime errors.
- Use `from __future__ import annotations` at the top of files for forward-compatible postponed evaluation.
- Prefer modern syntax: `list[int]`, `dict[str, int]`, `str | None` (Python 3.10+) over `List[int]`, `Optional[str]`.

```python
# Good
def get_user(user_id: int) -> User | None: ...

# Avoid
def get_user(user_id): ...
```

### Project layout

Use the `src/` layout — it prevents accidentally importing your package from the repo root before it's installed:

```
project/
├── pyproject.toml
├── src/
│   └── mypkg/
│       ├── __init__.py
│       └── ...
├── tests/
└── README.md
```

Manage dependencies with `pyproject.toml`. Use `uv`, `poetry`, or `pip-tools` to produce a lockfile. Never ship a `requirements.txt` without pinned versions for production code.

### Virtual environments

- Always work inside a venv (`uv venv`, `python -m venv`, etc.). Never `pip install` into the system Python.
- Pin Python versions with `.python-version` (pyenv/uv) or `pyproject.toml`'s `requires-python`.

### Error handling

- Catch specific exceptions, not bare `except:` or `except Exception:`. Catch broadly only at top-level entry points where you intend to log and exit gracefully.
- Don't swallow exceptions silently — at minimum log them.
- Raise custom exceptions for domain errors instead of reusing `ValueError` for everything.
- Use `raise NewError(...) from err` to preserve the cause when re-raising.

```python
# Good
try:
    result = parse_config(path)
except FileNotFoundError as e:
    raise ConfigMissingError(f"No config at {path}") from e

# Bad
try:
    result = parse_config(path)
except:
    pass  # silent failure — disaster in production
```

### Logging, not print

- Use the `logging` module. `print` belongs in scripts and demos, not in libraries or services.
- Get a module-level logger: `logger = logging.getLogger(__name__)`.
- Use levels properly: `DEBUG` for diagnostics, `INFO` for normal flow, `WARNING` for recoverable issues, `ERROR` for failures, `CRITICAL` for "page someone."
- Never log secrets, passwords, tokens, PII, or full request bodies.

### Idiomatic Python

- **f-strings** for formatting — not `%` or `.format()`.
- **`pathlib.Path`** for filesystem paths — not string concatenation or `os.path.join`.
- **Context managers** (`with`) for files, locks, DB connections, network sockets. Always.
- **Comprehensions** for simple transformations; regular loops for anything with side effects or more than two lines of logic.
- **Dataclasses** or **Pydantic** for structured data — not bare dicts passed around the codebase.
- **`enumerate`** instead of `range(len(x))`. **`zip`** to iterate pairs.
- **`collections.defaultdict`** and **`Counter`** when they fit.

### Common pitfalls to avoid

- **Mutable default arguments**: `def f(x=[])` shares one list across calls. Use `def f(x: list | None = None)` and initialize inside.
- **Late binding in closures and loops**: capture loop variables via default arg, e.g. `lambda x, i=i: ...`.
- **`is` vs `==`**: `is` is identity, `==` is equality. Use `is` only for `None`, `True`, `False`.
- **Modifying a list while iterating it**: iterate a copy or build a new list.

### Testing

- Use **`pytest`**. Aim for meaningful coverage, not a number — but track it (`coverage.py`).
- Test behavior, not implementation. Keep tests focused; one logical assertion per test where reasonable.
- Use fixtures for setup; `parametrize` for table-driven tests.
- Mock external boundaries (network, filesystem, time) — don't mock your own code.
- Run tests in CI on every PR.

### Documentation

- Every public function and class gets a docstring. Pick Google or NumPy style and stay consistent.
- Docstrings explain _why_ and _what_ (the _how_ is the code itself). Note edge cases, exceptions raised, and side effects.
- Keep a `README.md` covering: what it does, how to install, how to run, how to test.

### Performance

- Don't optimize until you've profiled (`cProfile`, `py-spy`). Most "slow" Python code is slow because of I/O or algorithmic complexity, not the language.
- Use generators for large data streams instead of building lists in memory.
- For CPU-bound work in a service, use multiprocessing or offload to a faster language — threads won't help (GIL).
- For I/O-bound concurrency, use `asyncio`, but commit to async end-to-end. Mixing sync and async carelessly is worse than pure sync.

---

## Security checklist

These map directly to OWASP Top 10 categories and findings from Bandit, Semgrep, ruff `S` rules, and Snyk. Each item lists the typical SAST rule ID where applicable.

### 1. Injection (OWASP A03)

**SQL injection** — Use parameterized queries. Never f-string or `%` user input into SQL.
_Tools: Bandit `B608`, Semgrep `python.sqlalchemy.security` rulesets._

```python
# Bad — SQL injection
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

# Good — parameterized
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```

Use the ORM properly (SQLAlchemy, Django ORM). Be aware that raw `.raw()` or `text()` calls reintroduce the risk.

**Command injection** — Never pass user input to `os.system`, `subprocess.*(..., shell=True)`, or `eval`/`exec`.
_Tools: Bandit `B602`, `B605`, `B607`; ruff `S602`, `S603`, `S605`._

```python
# Bad
os.system(f"convert {user_file} out.png")
subprocess.run(f"grep {pattern} file", shell=True)

# Good
subprocess.run(["convert", user_file, "out.png"], check=True)
subprocess.run(["grep", pattern, "file"], check=True)
```

If you must use a shell, validate input against an allowlist first. Never trust regex-based "sanitization" for shell input.

**`eval` / `exec` / `compile` on user input** — Just don't. If you think you need to, you don't.
_Tools: Bandit `B307`, ruff `S307`._

**Template injection** — Use Jinja2 with autoescape on; never call `Template(user_input).render()`.

### 2. Insecure deserialization (OWASP A08)

- **`pickle`** on untrusted data is remote code execution. Use JSON or msgpack for untrusted input.
  _Bandit `B301`, ruff `S301`._
- **`yaml.load(data)`** without a safe Loader is unsafe. Use `yaml.safe_load(data)`.
  _Bandit `B506`, ruff `S506`._
- **XML parsing**: `xml.etree`, `lxml`, and `xml.dom` are vulnerable to XXE and billion-laughs attacks on untrusted input. Use **`defusedxml`**.
  _Bandit `B313`–`B320`._

### 3. Cryptographic failures (OWASP A02)

- Use **`secrets`** (not `random`) for tokens, password resets, session IDs, and anything else security-relevant.
  _Bandit `B311`, ruff `S311`._
- Password hashing: **`argon2-cffi`** or **`bcrypt`**. Never MD5, SHA1, or plain SHA256 for passwords.
  _Bandit `B303`–`B304`._
- Symmetric encryption: use the **`cryptography`** library's Fernet or AEAD modes (AES-GCM). Don't roll your own.
- TLS: verify certificates. Never `verify=False` in `requests` — except in carefully isolated dev code that doesn't ship.
  _Bandit `B501`._
- Never hardcode secrets in source. Use environment variables, AWS Secrets Manager, Vault, etc. Scan repos with `gitleaks` or `trufflehog`.

### 4. Broken authentication and session management (OWASP A07)

- Hash passwords with argon2 or bcrypt (see above). Salt is automatic with these libraries.
- Use a battle-tested library for auth (Authlib, `django.contrib.auth`, FastAPI's OAuth2 helpers). Don't write JWT verification by hand.
- Set session cookies with `Secure`, `HttpOnly`, and `SameSite=Lax` (or `Strict`).
- Rate-limit auth endpoints to slow credential stuffing.

### 5. Path traversal and unsafe file handling

- Validate that resolved paths stay within an expected directory:

```python
from pathlib import Path

base = Path("/srv/uploads").resolve()
target = (base / user_supplied_name).resolve()
if not target.is_relative_to(base):  # Python 3.9+
    raise ValueError("Path traversal attempt")
```

- Don't use `tempfile.mktemp` (race condition); use `tempfile.NamedTemporaryFile` or `mkstemp`.
  _Bandit `B306`._
- Set explicit file permissions on sensitive files (`os.chmod(path, 0o600)`).

### 6. Server-Side Request Forgery (SSRF) (OWASP A10)

- If your app makes HTTP requests to user-supplied URLs, validate against an allowlist of domains.
- Block requests to private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`) and the cloud metadata endpoint `169.254.169.254`.
- Disable redirects, or follow them carefully — each redirect needs the same validation.

### 7. Vulnerable and outdated components (OWASP A06)

- Pin dependencies and lock them with `uv.lock`, `poetry.lock`, or `pip-tools`.
- Run **`pip-audit`** or **`safety`** in CI. Treat findings as bugs, not warnings.
- Enable **Dependabot** or **Renovate** to keep dependencies current.
- Watch for typosquatting — verify package names before installing (`requets` vs `requests`).

### 8. Security misconfiguration (OWASP A05)

- `DEBUG = False` in production. Debug pages leak source code and configuration.
- Don't return stack traces to users. Log them; show a generic error.
- Set security headers (Content-Security-Policy, X-Content-Type-Options, Strict-Transport-Security) using the `secure` package or your framework's middleware.
- Bind dev servers to `127.0.0.1`, not `0.0.0.0`, unless you intentionally want exposure.
  _Bandit `B104`._
- `assert` statements are stripped under `python -O`. Don't use `assert` for security checks or input validation.
  _Bandit `B101`, ruff `S101`._

### 9. XSS and output encoding

- Use a templating engine with autoescape (Jinja2, Django templates). Don't concatenate strings into HTML.
- For JSON responses to browsers, set `Content-Type: application/json` (not `text/html`).
- Sanitize user-supplied HTML with `bleach` or similar — never with a regex.

### 10. Security logging and monitoring (OWASP A09)

- Log authentication events, access control failures, input validation failures, and admin actions.
- Don't log secrets, passwords, session tokens, full card numbers, or PII you don't strictly need.
- Centralize logs (CloudWatch, ELK, Datadog) and alert on anomalies.

### 11. Regex denial of service (ReDoS)

- Avoid catastrophic backtracking patterns: nested quantifiers like `(a+)+` against attacker-controlled input.
- For user-supplied patterns, use a timeout wrapper or `re2` (via `google-re2`) which gives linear-time guarantees.

### 12. Resource limits and timeouts

- Always set timeouts on network calls: `requests.get(url, timeout=10)`. Hanging connections exhaust workers and become a DoS vector.
- Set max upload sizes in your web framework.
- Use `with` blocks for connections so they're released on exception.

---

## Tooling — what to run

Configure these in `pyproject.toml` and wire into CI and pre-commit:

| Tool                    | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `ruff`                  | Linter + formatter; includes Bandit's `S` rules for security        |
| `mypy` or `pyright`     | Static type checking                                                |
| `pytest` + `coverage`   | Tests and coverage                                                  |
| `bandit`                | Dedicated security linter (redundant if ruff `S` rules are enabled) |
| `pip-audit` or `safety` | Known-CVE check on dependencies                                     |
| `semgrep`               | Pattern-based SAST with curated security rulesets                   |
| `pre-commit`            | Run lint/format/audit before every commit                           |

For runtime DAST testing of web services, point **OWASP ZAP** or **Burp Suite** at the running app. They catch what static analysis can't — auth flaws in practice, real SSRF reachability, misconfigured CORS.

---

## Code review pass

When reviewing Python, scan in this order — most security bugs are caught in the first three:

1. **String formatting into SQL, shell, file paths, HTML, or templates?** → Injection risk.
2. **`pickle`, `yaml.load`, `eval`, `exec`, raw `xml.etree` on untrusted data?** → Critical, fix immediately.
3. **Secrets, API keys, or passwords in source or logs?** → Rotate and remove.
4. **`except:` or `except Exception: pass`?** → Errors being swallowed.
5. **Missing type hints on public APIs?** → Add them.
6. **`requests` calls without `timeout=`?** → Add a timeout.
7. **Mutable default arguments, `assert` for validation, `random` for secrets?** → Fix.
8. **Tests covering the new behavior?** → Required before merge.
   If any of items 1–3 are present, the change should not merge until they're fixed.
