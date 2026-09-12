#!/usr/bin/env node
/**
 * Extract class, function, and method names from source code files.
 *
 * Uses regex-based extraction (best-effort, no external dependencies required).
 * Designed to be run by an AI agent to avoid spending LLM tokens on mechanical
 * symbol listing. The LLM then uses this output as a scaffold to write
 * explanations.
 *
 * Usage:
 *     node extract_symbols.js <project_root> [--extensions .py,.js,.ts]
 *
 * Output:
 *     Structured text to stdout, grouped by file, listing each symbol with its
 *     type (class, function, method, constant).
 */

const fs = require('fs');
const path = require('path');

// Directories to skip (mirrors tree_gen.js)
const SKIP_DIRS = new Set([
  '.git', '.svn', '.hg', 'node_modules', '__pycache__', '.mypy_cache',
  '.pytest_cache', '.ruff_cache', '.tox', '.nox', '.venv', 'venv', 'env',
  '.env', 'dist', 'build', 'out', '.next', '.nuxt', '.output', '.turbo',
  '.vercel', '.netlify', 'coverage', '.nyc_output', '.cache',
  '.parcel-cache', 'target', 'vendor', '.gradle', '.idea', '.vscode',
  '.terraform', '.serverless', '.eggs', '.ipynb_checkpoints'
]);

// Default file extensions to process
const DEFAULT_EXTENSIONS = new Set([
  '.py', '.js', '.jsx', '.ts', '.tsx', '.go', '.java', '.rb', '.rs',
  '.cs', '.kt', '.swift', '.php', '.scala', '.ex', '.exs'
]);

// Files to skip
const SKIP_FILES = new Set(['__init__.py', 'setup.py', 'conftest.py']);

// Regex patterns for different languages
const JS_TS_PATTERNS = [
  // Named function declarations (with optional export/async)
  { regex: /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)/, type: "function" },
  // Class declarations (with optional export)
  { regex: /(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/, type: "class" },
  // Arrow function assigned to const/let/var (with optional export)
  { regex: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/, type: "function" },
  // Arrow function assigned to const/let/var (single param, no parens)
  { regex: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\w+\s*=>/, type: "function" },
  // Class methods (inside class body) — public, private, protected, static, async
  { regex: /^\s+(?:public|private|protected|static|async|override|abstract|readonly|\s)*\s*(\w+)\s*\(/, type: "method" },
  // Exported constants (UPPER_CASE or PascalCase typically)
  { regex: /(?:export\s+)?const\s+([A-Z][A-Z_0-9]+)\s*=/, type: "constant" },
  // Type/Interface declarations (TypeScript)
  { regex: /(?:export\s+)?(?:type|interface)\s+(\w+)/, type: "type" }
];

const PYTHON_PATTERNS = [
    { regex: /^\s*class\s+(\w+)/, type: "class" },
    { regex: /^\s*def\s+(\w+)/, type: "function" },
    { regex: /^\s+def\s+(\w+)/, type: "method" },
    { regex: /^\s*([A-Z][A-Z_0-9]+)\s*=/, type: "constant" },
];

const GO_PATTERNS = [
  { regex: /^func\s+(\w+)\s*\(/, type: "function" },
  { regex: /^func\s+\(\w+\s+\*?\w+\)\s+(\w+)\s*\(/, type: "method" },
  { regex: /^type\s+(\w+)\s+struct\s*\{/, type: "struct" },
  { regex: /^type\s+(\w+)\s+interface\s*\{/, type: "interface" },
  { regex: /^var\s+([A-Z]\w*)\s/, type: "variable" },
  { regex: /^const\s+([A-Z]\w*)\s/, type: "constant" }
];

const JAVA_PATTERNS = [
  { regex: /(?:public|private|protected|static|\s)*\s*class\s+(\w+)/, type: "class" },
  { regex: /(?:public|private|protected|static|\s)*\s*interface\s+(\w+)/, type: "interface" },
  { regex: /(?:public|private|protected|static|\s)*\s*enum\s+(\w+)/, type: "enum" },
  { regex: /(?:public|private|protected|static|final|abstract|synchronized|\s)+\s+\w+(?:<[^>]+>)?\s+(\w+)\s*\(/, type: "method" }
];

const RUBY_PATTERNS = [
  { regex: /^\s*class\s+(\w+)/, type: "class" },
  { regex: /^\s*module\s+(\w+)/, type: "module" },
  { regex: /^\s*def\s+(?:self\.)?(\w+[?!=]?)/, type: "method" },
  { regex: /^\s*([A-Z][A-Z_0-9]+)\s*=/, type: "constant" }
];

const RUST_PATTERNS = [
  { regex: /^\s*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/, type: "function" },
  { regex: /^\s*(?:pub\s+)?struct\s+(\w+)/, type: "struct" },
  { regex: /^\s*(?:pub\s+)?enum\s+(\w+)/, type: "enum" },
  { regex: /^\s*(?:pub\s+)?trait\s+(\w+)/, type: "trait" },
  { regex: /^\s*(?:pub\s+)?type\s+(\w+)/, type: "type" },
  { regex: /^\s*impl(?:<[^>]*>)?\s+(\w+)/, type: "impl" },
  { regex: /^\s*(?:pub\s+)?const\s+(\w+)/, type: "constant" },
  { regex: /^\s*(?:pub\s+)?static\s+(\w+)/, type: "static" }
];

const PHP_PATTERNS = [
  { regex: /^\s*(?:abstract\s+)?class\s+(\w+)/, type: "class" },
  { regex: /^\s*interface\s+(\w+)/, type: "interface" },
  { regex: /^\s*trait\s+(\w+)/, type: "trait" },
  { regex: /^\s*(?:public|private|protected|static|\s)*\s*function\s+(\w+)/, type: "function" },
  { regex: /^\s*const\s+(\w+)/, type: "constant" }
];

// Map extensions to their pattern sets
const LANG_PATTERNS = {
  ".py": PYTHON_PATTERNS,
  ".js": JS_TS_PATTERNS,
  ".jsx": JS_TS_PATTERNS,
  ".ts": JS_TS_PATTERNS,
  ".tsx": JS_TS_PATTERNS,
  ".go": GO_PATTERNS,
  ".java": JAVA_PATTERNS,
  ".rb": RUBY_PATTERNS,
  ".rs": RUST_PATTERNS,
  ".php": PHP_PATTERNS,
  ".cs": JAVA_PATTERNS,   // C# is close enough to Java patterns
  ".kt": JAVA_PATTERNS,   // Kotlin is close enough
  ".swift": JAVA_PATTERNS, // Swift is close enough for basic extraction
  ".scala": JAVA_PATTERNS,
};

function fnmatch(name, pattern) {
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

function isIgnored(relPath, isDir, patterns) {
  const name = path.basename(relPath);
  const normalizedRelPath = relPath.replace(/\\/g, '/');
  
  const checkPaths = [normalizedRelPath, name];
  if (isDir) {
    checkPaths.push(normalizedRelPath + '/');
    checkPaths.push(name + '/');
  }

  for (const pattern of patterns) {
    const clean = pattern.replace(/\/$/, ''); 
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

function extractRegexSymbols(filepath, patterns) {
  const symbols = [];
  const seen = new Set();
  
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      for (const { regex, type } of patterns) {
        const match = line.match(regex);
        if (match) {
          const name = match[1];
          // Skip common false positives
          const skippedNames = new Set(["if", "else", "for", "while", "return", "switch", "case",
                      "try", "catch", "throw", "new", "delete", "typeof", "void",
                      "constructor", "super", "this", "self", "import", "from",
                      "require", "module", "exports"]);
          if (skippedNames.has(name)) continue;
          
          const key = `${name}:${type}`;
          if (!seen.has(key)) {
            seen.add(key);
            symbols.push({ name, type });
          }
          break; // Only first matching pattern per line
        }
      }
    }
  } catch (err) {
      // ignore read errors
  }
  return symbols;
}

function walkProject(root, extensions, gitignorePatterns) {
  const files = [];

  function walk(currentDir) {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      const name = entry.name;
      const fullPath = path.join(currentDir, name);
      const relPath = path.relative(root, fullPath);

      if (entry.isDirectory()) {
         if (SKIP_DIRS.has(name)) continue;
         if (isIgnored(relPath, true, gitignorePatterns)) continue;
         walk(fullPath);
      } else {
        if (SKIP_FILES.has(name)) continue;
        const ext = path.extname(name).toLowerCase();
        if (!extensions.has(ext)) continue;
        if (isIgnored(relPath, false, gitignorePatterns)) continue;
        files.push(fullPath);
      }
    }
  }
  
  walk(root);
  return files;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    console.error('Usage: node extract_symbols.js <project_root> [--extensions .py,.js,.ts]');
    process.exit(1);
  }

  const rootPath = args[0];
  let extensionsArg = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--extensions' && i + 1 < args.length) {
      extensionsArg = args[++i];
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

  let extensions = DEFAULT_EXTENSIONS;
  if (extensionsArg) {
      extensions = new Set(extensionsArg.split(',').map(ext => {
          const trimmed = ext.trim();
          return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
      }));
  }

  const gitignorePatterns = parseGitignore(root);
  const files = walkProject(root, extensions, gitignorePatterns);

  if (files.length === 0) {
    console.error("No source files found.");
    process.exit(0);
  }

  let totalSymbols = 0;
  let totalFiles = 0;

  for (const filepath of files) {
      const ext = path.extname(filepath).toLowerCase();
      const patterns = LANG_PATTERNS[ext];
      if (!patterns) continue;
      
      const symbols = extractRegexSymbols(filepath, patterns);
      if (symbols.length === 0) continue;
      
      totalFiles++;
      const relPath = path.relative(root, filepath).replace(/\\/g, '/');
      console.log(`\n### \`${relPath}\``);
      console.log(`| Symbol | Type |`);
      console.log(`|:-------|:-----|`);
      for (const { name, type } of symbols) {
         totalSymbols++;
         console.log(`| \`${name}\` | ${type} |`);
      }
  }

  console.log(`\n---`);
  console.log(`Total: ${totalSymbols} symbols across ${totalFiles} files`);
}

if (require.main === module) {
  main();
}
