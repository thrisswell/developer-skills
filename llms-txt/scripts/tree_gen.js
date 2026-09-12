#!/usr/bin/env node
/**
 * Cross-platform directory tree generator for llms.txt.
 *
 * Generates an ASCII tree of the project structure, respecting .gitignore patterns
 * and skipping common generated/binary directories. Designed to be run by an AI agent
 * to avoid spending LLM tokens on mechanical file listing.
 *
 * Usage:
 *     node tree_gen.js <project_root> [--max-depth N] [--max-files N]
 *
 * Output:
 *     ASCII tree printed to stdout. Pipe or capture as needed.
 */

const fs = require('fs');
const path = require('path');

// Directories to always skip (case-sensitive match on directory name)
const ALWAYS_SKIP_DIRS = new Set([
  '.git', '.svn', '.hg', 'node_modules', '__pycache__', '.mypy_cache',
  '.pytest_cache', '.ruff_cache', '.tox', '.nox', '.venv', 'venv', 'env',
  '.env', 'dist', 'build', 'out', '.next', '.nuxt', '.output', '.turbo',
  '.vercel', '.netlify', 'coverage', '.nyc_output', '.cache',
  '.parcel-cache', 'target', 'vendor', '.gradle', '.idea', '.vscode',
  '.DS_Store', 'Thumbs.db', '.terraform', '.serverless', 'egg-info',
  '*.egg-info', '.eggs', '.ipynb_checkpoints'
]);

// File patterns to always skip
const ALWAYS_SKIP_FILES = new Set([
  '.DS_Store', 'Thumbs.db', 'desktop.ini', '*.pyc', '*.pyo', '*.class',
  '*.o', '*.so', '*.dylib', '*.dll', '*.exe', '*.wasm', '*.min.js',
  '*.min.css', '*.map', '*.lock', 'package-lock.json', 'yarn.lock',
  'pnpm-lock.yaml', 'uv.lock', 'poetry.lock', 'Gemfile.lock', 'Cargo.lock',
  'composer.lock', 'go.sum'
]);

// Basic fnmatch implementation since Node lacks a built-in one
function fnmatch(name, pattern) {
  // Very basic globbing for standard gitignore/skip list patterns
  if (pattern.startsWith('*') && pattern.endsWith('*')) {
    return name.includes(pattern.slice(1, -1));
  }
  if (pattern.startsWith('*')) {
    return name.endsWith(pattern.slice(1));
  }
  if (pattern.endsWith('*')) {
    return name.startsWith(pattern.slice(0, -1));
  }
  return name === pattern;
}

function parseGitignore(projectRoot) {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const patterns = [];
  try {
    if (fs.existsSync(gitignorePath)) {
      const content = fs.readFileSync(gitignorePath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          patterns.push(trimmed);
        }
      }
    }
  } catch (err) {
    // Ignore errors reading gitignore
  }
  return patterns;
}

function isGitignored(relPath, isDir, patterns) {
  const name = path.basename(relPath);
  // Normalise paths to forward slashes for matching
  const normalizedRelPath = relPath.replace(/\\/g, '/');
  
  const checkPaths = [normalizedRelPath, name];
  if (isDir) {
    checkPaths.push(normalizedRelPath + '/');
    checkPaths.push(name + '/');
  }

  for (const pattern of patterns) {
    const clean = pattern.replace(/\/$/, ''); // Remove trailing slash
    
    for (const cp of checkPaths) {
      if (fnmatch(cp, clean) || fnmatch(cp, pattern)) {
        return true;
      }
      
      if (isDir && pattern.endsWith('/') && fnmatch(name, clean)) {
         return true;
      }
      
      if (pattern.startsWith('/') && fnmatch(cp, pattern.replace(/^\//, ''))) {
          return true;
      }
    }
  }
  return false;
}

function shouldSkipDir(name) {
  if (ALWAYS_SKIP_DIRS.has(name)) return true;
  for (const pattern of ALWAYS_SKIP_DIRS) {
    if (pattern.includes('*') && fnmatch(name, pattern)) return true;
  }
  return false;
}

function shouldSkipFile(name) {
  if (ALWAYS_SKIP_FILES.has(name)) return true;
  for (const pattern of ALWAYS_SKIP_FILES) {
    if (pattern.includes('*') && fnmatch(name, pattern)) return true;
  }
  return false;
}

function generateTree(root, gitignorePatterns, maxDepth = 10, maxFiles = 1000) {
  const lines = [];
  let fileCount = 0;

  lines.push(path.basename(root) + '/');

  function walk(current, prefix, depth) {
    if (depth > maxDepth) {
      lines.push(prefix + '└── ... (max depth reached)');
      return;
    }

    if (fileCount >= maxFiles) {
      lines.push(prefix + '└── ... (max file count reached)');
      return;
    }

    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (err) {
      lines.push(prefix + '└── [permission denied]');
      return;
    }

    // Sort: directories first, then alphabetically
    entries.sort((a, b) => {
      const aIsDir = a.isDirectory();
      const bIsDir = b.isDirectory();
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    const visible = [];
    for (const entry of entries) {
      const name = entry.name;
      const fullPath = path.join(current, name);
      const relPath = path.relative(root, fullPath);
      const isDir = entry.isDirectory();

      if (isDir) {
        if (shouldSkipDir(name)) continue;
        if (isGitignored(relPath, true, gitignorePatterns)) continue;
        visible.push(entry);
      } else {
        if (shouldSkipFile(name)) continue;
        if (isGitignored(relPath, false, gitignorePatterns)) continue;
        visible.push(entry);
      }
    }

    for (let i = 0; i < visible.length; i++) {
      const entry = visible[i];
      const isLast = i === visible.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const extension = isLast ? '    ' : '│   ';
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        lines.push(`${prefix}${connector}${entry.name}/`);
        walk(fullPath, prefix + extension, depth + 1);
      } else {
        fileCount++;
        if (fileCount > maxFiles) {
           lines.push(`${prefix}${connector}... (max file count reached)`);
           return;
        }
        lines.push(`${prefix}${connector}${entry.name}`);
      }
    }
  }

  walk(root, '', 0);
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    console.error('Usage: node tree_gen.js <project_root> [--max-depth N] [--max-files N]');
    process.exit(1);
  }

  let rootPath = args[0];
  let maxDepth = 10;
  let maxFiles = 1000;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--max-depth' && i + 1 < args.length) {
      maxDepth = parseInt(args[++i], 10);
    } else if (args[i] === '--max-files' && i + 1 < args.length) {
      maxFiles = parseInt(args[++i], 10);
    }
  }

  const root = path.resolve(rootPath);
  try {
    if (!fs.statSync(root).isDirectory()) {
      console.error(`Error: '${root}' is not a directory.`);
      process.exit(1);
    }
  } catch(err) {
      console.error(`Error: Cannot access '${root}'.`);
      process.exit(1);
  }

  const gitignorePatterns = parseGitignore(root);
  const tree = generateTree(root, gitignorePatterns, maxDepth, maxFiles);
  console.log(tree);
}

if (require.main === module) {
  main();
}
