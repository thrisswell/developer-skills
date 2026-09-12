#!/usr/bin/env python3
"""
Extract class, function, and method names from source code files.

Uses Python's `ast` module for .py files (accurate, AST-based parsing) and
regex-based extraction for JS/TS/Go/Java/Ruby/Rust files (best-effort, no
external dependencies required).

Designed to be run by an AI agent to avoid spending LLM tokens on mechanical
symbol listing. The LLM then uses this output as a scaffold to write
explanations.

Usage:
    python3 extract_symbols.py <project_root> [--extensions .py,.js,.ts]

Output:
    Structured text to stdout, grouped by file, listing each symbol with its
    type (class, function, method, constant).
"""

import argparse
import ast
import fnmatch
import os
import re
import sys
from pathlib import Path

# Directories to skip (mirrors tree_gen.py)
SKIP_DIRS = {
    ".git", ".svn", ".hg", "node_modules", "__pycache__", ".mypy_cache",
    ".pytest_cache", ".ruff_cache", ".tox", ".nox", ".venv", "venv", "env",
    ".env", "dist", "build", "out", ".next", ".nuxt", ".output", ".turbo",
    ".vercel", ".netlify", "coverage", ".nyc_output", ".cache",
    ".parcel-cache", "target", "vendor", ".gradle", ".idea", ".vscode",
    ".terraform", ".serverless", ".eggs", ".ipynb_checkpoints",
}

# Default file extensions to process
DEFAULT_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".java", ".rb", ".rs",
    ".cs", ".kt", ".swift", ".php", ".scala", ".ex", ".exs",
}

# Files to skip
SKIP_FILES = {"__init__.py", "setup.py", "conftest.py"}

# Regex patterns for different languages
JS_TS_PATTERNS = [
    # Named function declarations (with optional export/async)
    (r'(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)', "function"),
    # Class declarations (with optional export)
    (r'(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)', "class"),
    # Arrow function assigned to const/let/var (with optional export)
    (r'(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(', "function"),
    # Arrow function assigned to const/let/var (single param, no parens)
    (r'(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\w+\s*=>', "function"),
    # Class methods (inside class body) — public, private, protected, static, async
    (r'^\s+(?:public|private|protected|static|async|override|abstract|readonly|\s)*\s*(\w+)\s*\(', "method"),
    # Exported constants (UPPER_CASE or PascalCase typically)
    (r'(?:export\s+)?const\s+([A-Z][A-Z_0-9]+)\s*=', "constant"),
    # Type/Interface declarations (TypeScript)
    (r'(?:export\s+)?(?:type|interface)\s+(\w+)', "type"),
]

GO_PATTERNS = [
    (r'^func\s+(\w+)\s*\(', "function"),
    (r'^func\s+\(\w+\s+\*?\w+\)\s+(\w+)\s*\(', "method"),
    (r'^type\s+(\w+)\s+struct\s*\{', "struct"),
    (r'^type\s+(\w+)\s+interface\s*\{', "interface"),
    (r'^var\s+([A-Z]\w*)\s', "variable"),
    (r'^const\s+([A-Z]\w*)\s', "constant"),
]

JAVA_PATTERNS = [
    (r'(?:public|private|protected|static|\s)*\s*class\s+(\w+)', "class"),
    (r'(?:public|private|protected|static|\s)*\s*interface\s+(\w+)', "interface"),
    (r'(?:public|private|protected|static|\s)*\s*enum\s+(\w+)', "enum"),
    (r'(?:public|private|protected|static|final|abstract|synchronized|\s)+\s+\w+(?:<[^>]+>)?\s+(\w+)\s*\(', "method"),
]

RUBY_PATTERNS = [
    (r'^\s*class\s+(\w+)', "class"),
    (r'^\s*module\s+(\w+)', "module"),
    (r'^\s*def\s+(?:self\.)?(\w+[?!=]?)', "method"),
    (r'^\s*([A-Z][A-Z_0-9]+)\s*=', "constant"),
]

RUST_PATTERNS = [
    (r'^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)', "function"),
    (r'^\s*(?:pub\s+)?struct\s+(\w+)', "struct"),
    (r'^\s*(?:pub\s+)?enum\s+(\w+)', "enum"),
    (r'^\s*(?:pub\s+)?trait\s+(\w+)', "trait"),
    (r'^\s*(?:pub\s+)?type\s+(\w+)', "type"),
    (r'^\s*impl(?:<[^>]*>)?\s+(\w+)', "impl"),
    (r'^\s*(?:pub\s+)?const\s+(\w+)', "constant"),
    (r'^\s*(?:pub\s+)?static\s+(\w+)', "static"),
]

PHP_PATTERNS = [
    (r'^\s*(?:abstract\s+)?class\s+(\w+)', "class"),
    (r'^\s*interface\s+(\w+)', "interface"),
    (r'^\s*trait\s+(\w+)', "trait"),
    (r'^\s*(?:public|private|protected|static|\s)*\s*function\s+(\w+)', "function"),
    (r'^\s*const\s+(\w+)', "constant"),
]

# Map extensions to their pattern sets
LANG_PATTERNS = {
    ".js": JS_TS_PATTERNS,
    ".jsx": JS_TS_PATTERNS,
    ".ts": JS_TS_PATTERNS,
    ".tsx": JS_TS_PATTERNS,
    ".go": GO_PATTERNS,
    ".java": JAVA_PATTERNS,
    ".rb": RUBY_PATTERNS,
    ".rs": RUST_PATTERNS,
    ".php": PHP_PATTERNS,
    ".cs": JAVA_PATTERNS,   # C# is close enough to Java patterns
    ".kt": JAVA_PATTERNS,   # Kotlin is close enough
    ".swift": JAVA_PATTERNS, # Swift is close enough for basic extraction
    ".scala": JAVA_PATTERNS,
}


def extract_python_symbols(filepath: Path) -> list[tuple[str, str]]:
    """Extract symbols from a Python file using the ast module (accurate)."""
    symbols = []
    try:
        source = filepath.read_text(encoding="utf-8", errors="replace")
        tree = ast.parse(source, filename=str(filepath))
    except (SyntaxError, UnicodeDecodeError, ValueError):
        return symbols

    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.ClassDef):
            symbols.append((node.name, "class"))
            # Extract methods within the class
            for item in ast.iter_child_nodes(node):
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    if not item.name.startswith("_") or item.name in ("__init__", "__call__", "__enter__", "__exit__", "__aenter__", "__aexit__"):
                        symbols.append((f"  {node.name}.{item.name}", "method"))
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            symbols.append((node.name, "function"))
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id.isupper():
                    symbols.append((target.id, "constant"))
        elif isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name) and node.target.id.isupper():
                symbols.append((node.target.id, "constant"))

    return symbols


def extract_regex_symbols(filepath: Path, patterns: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """Extract symbols from a file using regex patterns (best-effort)."""
    symbols = []
    seen = set()
    try:
        source = filepath.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return symbols

    for line in source.splitlines():
        for pattern, symbol_type in patterns:
            match = re.search(pattern, line)
            if match:
                name = match.group(1)
                # Skip common false positives
                if name in ("if", "else", "for", "while", "return", "switch", "case",
                            "try", "catch", "throw", "new", "delete", "typeof", "void",
                            "constructor", "super", "this", "self", "import", "from",
                            "require", "module", "exports"):
                    continue
                key = (name, symbol_type)
                if key not in seen:
                    seen.add(key)
                    symbols.append((name, symbol_type))
                break  # Only first matching pattern per line

    return symbols


def extract_symbols(filepath: Path) -> list[tuple[str, str]]:
    """Extract symbols from a file based on its extension."""
    ext = filepath.suffix.lower()

    if ext == ".py":
        return extract_python_symbols(filepath)
    elif ext in LANG_PATTERNS:
        return extract_regex_symbols(filepath, LANG_PATTERNS[ext])
    else:
        return []


def parse_gitignore(project_root: Path) -> list[str]:
    """Parse .gitignore and return patterns."""
    gitignore_path = project_root / ".gitignore"
    patterns = []
    if gitignore_path.is_file():
        try:
            with open(gitignore_path, "r", encoding="utf-8", errors="replace") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        patterns.append(line)
        except OSError:
            pass
    return patterns


def is_ignored(rel_path: str, is_dir: bool, patterns: list[str]) -> bool:
    """Check if a path matches gitignore patterns."""
    name = os.path.basename(rel_path)
    check_paths = [rel_path, name]
    if is_dir:
        check_paths.extend([rel_path + "/", name + "/"])

    for pattern in patterns:
        clean = pattern.rstrip("/")
        for cp in check_paths:
            if fnmatch.fnmatch(cp, clean) or fnmatch.fnmatch(cp, pattern):
                return True
            if is_dir and pattern.endswith("/") and fnmatch.fnmatch(name, clean):
                return True
    return False


def walk_project(root: Path, extensions: set[str], gitignore_patterns: list[str]) -> list[Path]:
    """Walk the project and return source files to analyse."""
    files = []

    for dirpath, dirnames, filenames in os.walk(root):
        # Filter directories in-place to prevent os.walk from descending
        rel_dir = os.path.relpath(dirpath, root)
        dirnames[:] = [
            d for d in dirnames
            if d not in SKIP_DIRS
            and not is_ignored(
                os.path.join(rel_dir, d) if rel_dir != "." else d,
                True,
                gitignore_patterns,
            )
        ]

        for filename in sorted(filenames):
            if filename in SKIP_FILES:
                continue
            filepath = Path(dirpath) / filename
            if filepath.suffix.lower() not in extensions:
                continue
            rel_path = os.path.relpath(filepath, root)
            if is_ignored(rel_path, False, gitignore_patterns):
                continue
            files.append(filepath)

    return files


def main():
    parser = argparse.ArgumentParser(
        description="Extract class/function/method names from source files"
    )
    parser.add_argument("root", help="Path to the project root directory")
    parser.add_argument(
        "--extensions",
        type=str,
        default=None,
        help="Comma-separated file extensions to process (e.g. '.py,.js,.ts'). "
             "Defaults to all supported extensions.",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"Error: '{root}' is not a directory.", file=sys.stderr)
        sys.exit(1)

    if args.extensions:
        extensions = {ext.strip() if ext.strip().startswith(".") else f".{ext.strip()}"
                      for ext in args.extensions.split(",")}
    else:
        extensions = DEFAULT_EXTENSIONS

    gitignore_patterns = parse_gitignore(root)
    files = walk_project(root, extensions, gitignore_patterns)

    if not files:
        print("No source files found.", file=sys.stderr)
        sys.exit(0)

    total_symbols = 0
    total_files = 0

    for filepath in files:
        symbols = extract_symbols(filepath)
        if not symbols:
            continue

        total_files += 1
        rel_path = filepath.relative_to(root)
        print(f"\n### `{rel_path}`")
        print(f"| Symbol | Type |")
        print(f"|:-------|:-----|")
        for name, stype in symbols:
            total_symbols += 1
            print(f"| `{name}` | {stype} |")

    print(f"\n---")
    print(f"Total: {total_symbols} symbols across {total_files} files")


if __name__ == "__main__":
    main()
