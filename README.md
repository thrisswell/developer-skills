# Developer Skills for Claude & AI Agents

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Skills Standard](https://img.shields.io/badge/Format-Agentic%20Skills%20(SKILL.md)-blue)](https://github.com)

A curated collection of modular, production-grade skills and instructions for Claude and AI coding agents. These skills provide specialized workflows, security baselines, architectural reviews, and code refactoring guidelines for real-world software engineering tasks.

---

## 📌 Table of Contents

- [Overview](#overview)
- [Skills Catalog](#skills-catalog)
- [Skills Breakdown](#skills-breakdown)
  - [Architecture & Planning](#1-architecture--planning)
  - [Frontend & UI/UX](#2-frontend--uiux)
  - [Backend & APIs](#3-backend--apis)
  - [Security & Code Quality](#4-security--code-quality)
  - [Code Understanding & Communication](#5-code-understanding--communication)
- [How to Use](#how-to-use)
- [Directory Structure](#directory-structure)
- [Authoring New Skills](#authoring-new-skills)
- [Contributing](#contributing)
- [License](#license)

---

## 📖 Overview

This is a collection of ready-to-use skills built for JavaScript and Python developers to make everyday coding easier. 

Whether you're building APIs, refactoring React components, cleaning up dead code, or fixing security issues, these skills give your AI assistant clear instructions to deliver clean, production-ready code with less back-and-forth.

---

## 🗂️ Skills Catalog

| Skill | Category | Primary Focus | Best Used For |
| :--- | :--- | :--- | :--- |
| [`feasibility-check`](./feasibility-check/SKILL.md) | Architecture | Technical viability evaluation | Reality-checking proposals before writing code |
| [`create-express-api`](./create-express-api/SKILL.md) | Backend | Express.js REST API scaffolding | Clean, secure REST endpoints and routing |
| [`refactor-node`](./refactor-node/SKILL.md) | Backend | Production Node.js best practices | Hardened backend services, middleware, and DB queries |
| [`refactor-python`](./refactor-python/SKILL.md) | Backend | Modern Python & PEP 8 standards | Clean typing, defensive errors, and SAST hardening |
| [`connect-react-to-node-backend`](./connect-react-to-node-backend/SKILL.md) | Fullstack | Frontend-to-Backend integration | Wiring React UI components to backend endpoints |
| [`refactor-react-modular`](./refacotr-react-modular/SKILL.md) | Frontend | React component modularization | Breaking monolithic components into reusable units |
| [`improve-ux`](./improve-ux/SKILL.md) | Frontend | UI/UX polish & accessibility | Enhancing layout, responsive design, spacing, and a11y |
| [`refactor-css`](./refactor-css/SKILL.md) | Frontend | CSS modernization & responsiveness | Cleaning legacy styles, naming, and mobile responsiveness |
| [`fix-js-sec-bug`](./fix-js-sec-bug/SKILL.md) | Security | Root-cause vulnerability patching | Resolving SAST findings (Snyk, SonarQube, Semgrep, audit) |
| [`JS-dead-code-removal`](./JS-dead-code-removal/SKILL.md) | Code Quality | Evidence-based dead code pruning | Safely trimming JS/TS bundles without breaking behavior |
| [`explain-code`](./explain-code/SKILL.md) | Learning | Beginner-friendly code walkthroughs | Understanding data flow, hooks, and complex logic |
| [`brief-answers`](./brief-answers/SKILL.md) | Productivity | Ultra-concise communication | 3–4 line high-density answers without preamble |

---

## 🔍 Skills Breakdown

### 1. Architecture & Planning

#### [`feasibility-check`](./feasibility-check/SKILL.md)
* **Trigger:** *"Is it feasible to..."*, *"Can we build..."*, *"Would it work if..."*, *"Technical check before I start..."*
* **Description:** Evaluates technical viability, complexity, trade-offs, edge cases, and dependency hurdles before writing code. Deliberately performs analysis and reports findings without making unprompted file changes.

---

### 2. Frontend & UI/UX

#### [`refacotr-react-modular`](./refacotr-react-modular/SKILL.md)
* **Trigger:** *"Refactor this React component"*, *"Break this component down"*, *"Modularize frontend"*
* **Description:** Splits monolithic React components into clean, testable, and reusable child components while preserving state integrity and design guidelines.

#### [`improve-ux`](./improve-ux/SKILL.md)
* **Trigger:** *"Improve UX"*, *"Make this UI look better"*, *"Polish this React component"*
* **Description:** Elevates user interface quality by optimizing spacing, visual hierarchy, typography, mobile responsiveness, and WCAG accessibility standards.

#### [`refactor-css`](./refactor-css/SKILL.md)
* **Trigger:** *"Clean up this CSS"*, *"Make styles responsive"*, *"Modernize CSS"*
* **Description:** Refactors legacy or messy stylesheets into clean, modern, and responsive CSS with clear naming conventions and reduced specificity battles.

#### [`connect-react-to-node-backend`](./connect-react-to-node-backend/SKILL.md)
* **Trigger:** *"Connect frontend to backend"*, *"Integrate API with React"*, *"Fetch data from Node API"*
* **Description:** Bridges React client components to Node.js backend endpoints with robust handling for loading states, error states, and payload serialization.

---

### 3. Backend & APIs

#### [`create-express-api`](./create-express-api/SKILL.md)
* **Trigger:** *"Create an Express API"*, *"Scaffold REST endpoints"*, *"Build Node backend for requirement X"*
* **Description:** Creates organized, maintainable Express.js endpoints adhering to REST principles, centralized error handling, and cybersecurity baselines.

#### [`refactor-node`](./refactor-node/SKILL.md)
* **Trigger:** *"Refactor Node.js"*, *"Harden Express backend"*, *"Make this service production-ready"*
* **Description:** Applies production-grade Node.js standards: input validation schemas, parameterized DB queries (Postgres/MongoDB), structured logging, rate limits, timeouts, and safe headers.

#### [`refactor-python`](./refactor-python/SKILL.md)
* **Trigger:** *"Write Python service"*, *"Refactor Python code"*, *"Apply Python best practices"*
* **Description:** Enforces PEP 8, strict type hints, dependency management, structured logging, defensive error handling, and OWASP/SAST security hardening (Bandit, Semgrep, ruff).

---

### 4. Security & Code Quality

#### [`fix-js-sec-bug`](./fix-js-sec-bug/SKILL.md)
* **Trigger:** Scanner findings (Snyk, SonarQube, Semgrep, npm audit), CVE reports, pen-test notes.
* **Description:** Performs root-cause remediation of security flaws across full-stack JavaScript (Node.js and React), eliminating vulnerabilities without superficial band-aids.

#### [`JS-dead-code-removal`](./JS-dead-code-removal/SKILL.md)
* **Trigger:** *"Remove dead code"*, *"Delete unused imports/functions"*, *"Shrink bundle size safely"*
* **Description:** Eliminates provably unused code in JS/TS files. Includes reference guides for [Tooling](./JS-dead-code-removal/references/tooling.md) and a [Security Checklist](./JS-dead-code-removal/references/security-checklist.md) to prevent breaking dynamic references.

---

### 5. Code Understanding & Communication

#### [`explain-code`](./explain-code/SKILL.md)
* **Trigger:** *"Explain this code"*, *"Help me understand this function"*, *"Walk me through the data flow"*
* **Description:** Breaks down confusing code step-by-step for beginner developers, explaining high-level purpose, component interactions, hooks, and modification tips.

#### [`brief-answers`](./brief-answers/SKILL.md)
* **Trigger:** Explicit only — `/brief`, *"keep it short"*, *"tl;dr"*, *"quick answer"*
* **Description:** Delivers dense, 3–4 line responses with zero filler, no conversational preambles, and immediate value.

---

## 🚀 How to Use

You can install and use these skills either **globally** (available across all chats/projects) or **project-specifically** (scoped to a single codebase).

### 1. Claude (Claude Code, Desktop, & Web)

* **Project-Specific (Current Repository):**
  * **Claude Code / CLI:** Place the skill folder in your project's `.claude/skills/` directory:
    ```bash
    cp -r <skill-name> /path/to/project/.claude/skills/
    ```
  * **Claude.ai Projects:** Add the `SKILL.md` file to your **Project Knowledge** or paste into **Project Instructions**.

* **Global (All Projects):**
  * **Claude Code / CLI:** Place the skill folder in your global skills directory:
    ```bash
    cp -r <skill-name> ~/.claude/skills/
    ```
  * **Claude.ai Web:** Paste the skill instructions into your account's **Custom Instructions** (Profile Settings).

---

### 2. Antigravity & Agent IDEs

* **Project-Specific (Current Workspace):**
  * Place the skill folder inside `.agents/skills/` at your project root:
    ```bash
    cp -r <skill-name> /path/to/project/.agents/skills/
    ```

* **Global (All Workspaces):**
  * Place the skill folder inside your global customizations directory:
    ```bash
    cp -r <skill-name> ~/.gemini/config/skills/
    ```

---

## 📁 Directory Structure

```text
dev-skills/
├── README.md
├── JS-dead-code-removal/
│   ├── SKILL.md
│   └── references/
│       ├── security-checklist.md
│       └── tooling.md
├── brief-answers/
│   └── SKILL.md
├── connect-react-to-node-backend/
│   └── SKILL.md
├── create-express-api/
│   └── SKILL.md
├── explain-code/
│   └── SKILL.md
├── feasibility-check/
│   └── SKILL.md
├── fix-js-sec-bug/
│   └── SKILL.md
├── improve-ux/
│   └── SKILL.md
├── refactor-react-modular/
│   └── SKILL.md
├── refactor-css/
│   └── SKILL.md
├── refactor-node/
│   └── SKILL.md
└── refactor-python/
    └── SKILL.md
```

---

## 📄 License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT) — feel free to use, modify, and distribute these skills in personal, commercial, and open-source projects.
