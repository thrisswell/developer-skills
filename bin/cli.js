#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const command = args[0]; // e.g. "list", "add", "add-all"
const skillName = args[1];

const packageRoot = path.resolve(__dirname, '..');
const availableSkills = fs.readdirSync(packageRoot, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name !== 'bin' && dirent.name !== 'node_modules' && !dirent.name.startsWith('.'))
    .map(dirent => dirent.name);

// 1. Help & Listing
if (!command || command === 'help' || command === '--help') {
    console.log(`
Developer Skills CLI

Usage:
  npx developer-skills list
  npx developer-skills add <skill-name> [--claude | --agent] [--global]
  npx developer-skills add-all [--claude | --agent] [--global]

Options:
  --claude   Install to .claude/skills/ (Default)
  --agent    Install to .agents/skills/ (Antigravity & Agent IDEs)
  --global   Install to global user directory instead of project root
`);
    process.exit(0);
}

if (command === 'list') {
    console.log('\nAvailable Skills:\n');
    availableSkills.forEach(s => console.log(`  - ${s}`));
    console.log('');
    process.exit(0);
}

// Shared install helper
function installSkill(name, isAgent, isGlobal) {
    const homeDir = process.env.HOME || process.env.USERPROFILE;

    let destDir = '';
    if (isAgent) {
        destDir = isGlobal
            ? path.join(homeDir, '.gemini', 'config', 'skills', name)
            : path.join(process.cwd(), '.agents', 'skills', name);
    } else {
        destDir = isGlobal
            ? path.join(homeDir, '.claude', 'skills', name)
            : path.join(process.cwd(), '.claude', 'skills', name);
    }

    const srcDir = path.join(packageRoot, name);
    fs.mkdirSync(destDir, { recursive: true });
    fs.cpSync(srcDir, destDir, { recursive: true });
    console.log(`  ✅ ${name} → ${destDir}`);
}

// 2. Add single skill — or all if no name given
if (command === 'add' || command === 'install') {
    const isGlobal = args.includes('--global');
    const isAgent = args.includes('--agent');

    // No skill name given → install everything
    if (!skillName || skillName.startsWith('--')) {
        console.log(`\nInstalling all ${availableSkills.length} skills...\n`);
        availableSkills.forEach(name => installSkill(name, isAgent, isGlobal));
        console.log('\nDone!\n');
        process.exit(0);
    }

    if (!availableSkills.includes(skillName)) {
        console.error(`\n❌ Error: Skill "${skillName}" not found.`);
        console.log(`Available skills: ${availableSkills.join(', ')}\n`);
        process.exit(1);
    }

    console.log('');
    installSkill(skillName, isAgent, isGlobal);
    console.log('');
}

// 3. Add all skills at once
if (command === 'add-all') {
    const isGlobal = args.includes('--global');
    const isAgent = args.includes('--agent');

    console.log(`\nInstalling all ${availableSkills.length} skills...\n`);
    availableSkills.forEach(name => installSkill(name, isAgent, isGlobal));
    console.log('\nDone!\n');
}
