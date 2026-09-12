#!/usr/bin/env python3
"""
Cross-platform directory tree generator for llms.txt.

Generates an ASCII tree of the project structure, respecting .gitignore patterns
and skipping common generated/binary directories. Designed to be run by an AI agent
to avoid spending LLM tokens on mechanical file listing.

Usage:
    python3 tree_gen.py <project_root> [--max-depth N] [--max-files N]

Output:
    ASCII tree printed to stdout. Pipe or capture as needed.
"""

import argparse
import fnmatch
import os
import sys
from pathlib import Path

# Directories to always skip (case-sensitive match on directory name)
ALWAYS_SKIP_DIRS = {
    ".git",
    ".svn",
    ".hg",
    "node_modules",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".tox",
    ".nox",
    ".venv",
    "venv",
    "env",
    ".env",
    "dist",
    "build",
    "out",
    ".next",
    ".nuxt",
    ".output",
    ".turbo",
    ".vercel",
    ".netlify",
    "coverage",
    ".nyc_output",
    ".cache",
    ".parcel-cache",
    "target",          # Rust/Java build output
    "vendor",          # Go/PHP vendor
    ".gradle",
    ".idea",
    ".vscode",
    ".DS_Store",
    "Thumbs.db",
    ".terraform",
    ".serverless",
    "egg-info",
    "*.egg-info",
    ".eggs",
    ".ipynb_checkpoints",
}

# File patterns to always skip
ALWAYS_SKIP_FILES = {
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini",
    "*.pyc",
    "*.pyo",
    "*.class",
    "*.o",
    "*.so",
    "*.dylib",
    "*.dll",
    "*.exe",
    "*.wasm",
    "*.min.js",
    "*.min.css",
    "*.map",
    "*.lock",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "uv.lock",
    "poetry.lock",
    "Gemfile.lock",
    "Cargo.lock",
    "composer.lock",
    "go.sum",
}


def parse_gitignore(project_root: Path) -> list[str]:
    """Parse .gitignore and return a list of patterns."""
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


def is_gitignored(rel_path: str, is_dir: bool, patterns: list[str]) -> bool:
    """Check if a relative path matches any gitignore pattern."""
    name = os.path.basename(rel_path)
    check_paths = [rel_path, name]
    if is_dir:
        check_paths.extend([rel_path + "/", name + "/"])

    for pattern in patterns:
        clean = pattern.rstrip("/")
        for cp in check_paths:
            if fnmatch.fnmatch(cp, clean) or fnmatch.fnmatch(cp, pattern):
                return True
            # Handle patterns like "dir/" matching directory names
            if is_dir and pattern.endswith("/") and fnmatch.fnmatch(name, clean):
                return True
            # Handle patterns with leading slash (relative to root)
            if pattern.startswith("/") and fnmatch.fnmatch(cp, pattern.lstrip("/")):
                return True
    return False


def should_skip_dir(name: str) -> bool:
    """Check if a directory name matches the always-skip list."""
    if name in ALWAYS_SKIP_DIRS:
        return True
    # Check wildcard patterns in skip list
    for pattern in ALWAYS_SKIP_DIRS:
        if "*" in pattern and fnmatch.fnmatch(name, pattern):
            return True
    return False


def should_skip_file(name: str) -> bool:
    """Check if a file name matches the always-skip list."""
    if name in ALWAYS_SKIP_FILES:
        return True
    for pattern in ALWAYS_SKIP_FILES:
        if "*" in pattern and fnmatch.fnmatch(name, pattern):
            return True
    return False


def generate_tree(
    root: Path,
    gitignore_patterns: list[str],
    max_depth: int = 10,
    max_files: int = 1000,
) -> str:
    """Generate an ASCII directory tree."""
    lines: list[str] = []
    file_count = 0

    lines.append(root.name + "/")

    def _walk(current: Path, prefix: str, depth: int):
        nonlocal file_count

        if depth > max_depth:
            lines.append(prefix + "└── ... (max depth reached)")
            return

        if file_count >= max_files:
            lines.append(prefix + "└── ... (max file count reached)")
            return

        try:
            entries = sorted(current.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
        except PermissionError:
            lines.append(prefix + "└── [permission denied]")
            return

        # Filter entries
        visible = []
        for entry in entries:
            name = entry.name
            rel = str(entry.relative_to(root))

            if entry.is_dir():
                if should_skip_dir(name):
                    continue
                if is_gitignored(rel, True, gitignore_patterns):
                    continue
                visible.append(entry)
            else:
                if should_skip_file(name):
                    continue
                if is_gitignored(rel, False, gitignore_patterns):
                    continue
                visible.append(entry)

        for i, entry in enumerate(visible):
            is_last = i == len(visible) - 1
            connector = "└── " if is_last else "├── "
            extension = "    " if is_last else "│   "

            if entry.is_dir():
                lines.append(f"{prefix}{connector}{entry.name}/")
                _walk(entry, prefix + extension, depth + 1)
            else:
                file_count += 1
                if file_count > max_files:
                    lines.append(f"{prefix}{connector}... (max file count reached)")
                    return
                lines.append(f"{prefix}{connector}{entry.name}")

    _walk(root, "", 0)
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Generate an ASCII directory tree for llms.txt"
    )
    parser.add_argument("root", help="Path to the project root directory")
    parser.add_argument(
        "--max-depth",
        type=int,
        default=10,
        help="Maximum directory depth (default: 10)",
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=1000,
        help="Maximum number of files to list (default: 1000)",
    )
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not root.is_dir():
        print(f"Error: '{root}' is not a directory.", file=sys.stderr)
        sys.exit(1)

    gitignore_patterns = parse_gitignore(root)
    tree = generate_tree(root, gitignore_patterns, args.max_depth, args.max_files)
    print(tree)


if __name__ == "__main__":
    main()
