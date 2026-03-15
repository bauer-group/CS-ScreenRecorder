#!/usr/bin/env node
/**
 * Remove Cap Messenger Widget Patch (Self-Hosted)
 *
 * Removes the built-in Cap Messenger chat widget which replaced Intercom
 * in Cap v0.4.7+. The widget is gated behind NEXT_PUBLIC_IS_CAP === "true"
 * but this patch ensures it is completely removed for self-hosted deployments.
 *
 * Targets:
 *   - MessengerWidget imports in layout files
 *   - MessengerWidget JSX rendering
 *   - Messenger CSS imports (if any)
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const APP_DIR = process.env.APP_DIR || '/app';

// Colors
const c = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', reset: '\x1b[0m'
};

const log = {
  info: (msg) => console.log(`${c.blue}${msg}${c.reset}`),
  ok: (msg) => console.log(`${c.green}  ✓ ${msg}${c.reset}`),
  warn: (msg) => console.log(`${c.yellow}  • ${msg}${c.reset}`),
  err: (msg) => console.log(`${c.red}  ✗ ${msg}${c.reset}`)
};

console.log(`${c.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
console.log(`${c.blue}  Remove Messenger Widget (Self-Hosted)${c.reset}`);
console.log(`${c.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

let modifiedFiles = 0;

async function main() {
  log.info('Searching for MessengerWidget references...\n');

  // Find all TypeScript/JavaScript files in the web app
  const files = await glob('apps/web/**/*.{ts,tsx,js,jsx,mjs}', {
    cwd: APP_DIR,
    ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
    absolute: true
  });

  log.info(`Scanning ${files.length} source files\n`);

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (e) {
      continue;
    }

    // Only process files that reference MessengerWidget
    if (!content.includes('MessengerWidget')) {
      continue;
    }

    const relativePath = path.relative(APP_DIR, file);
    log.info(`Processing: ${relativePath}`);

    let newContent = content;
    let modified = false;

    // =========================================================================
    // 1. Remove MessengerWidget import statements
    // =========================================================================
    // Pattern: import { MessengerWidget } from "../Layout/MessengerWidget";
    // Pattern: import MessengerWidget from "../Layout/MessengerWidget";
    // Pattern: import { MessengerWidget } from "@/app/Layout/MessengerWidget";
    const importRegex = /^import\s+(?:\{[^}]*MessengerWidget[^}]*\}|MessengerWidget)\s+from\s+["'][^"']*MessengerWidget["'];?\s*$/gm;
    if (importRegex.test(newContent)) {
      newContent = newContent.replace(importRegex, '// [SELF-HOSTED] MessengerWidget removed');
      log.ok('Removed MessengerWidget import');
      modified = true;
    }

    // =========================================================================
    // 2. Remove conditional MessengerWidget rendering
    // =========================================================================
    // Pattern: {buildEnv.NEXT_PUBLIC_IS_CAP === "true" && <MessengerWidget />}
    const conditionalRenderRegex = /\{[^}]*NEXT_PUBLIC_IS_CAP[^}]*&&\s*<MessengerWidget\s*\/>\s*\}/g;
    if (conditionalRenderRegex.test(newContent)) {
      newContent = newContent.replace(conditionalRenderRegex, '{/* [SELF-HOSTED] MessengerWidget removed */}');
      log.ok('Removed conditional MessengerWidget rendering');
      modified = true;
    }

    // =========================================================================
    // 3. Remove standalone MessengerWidget JSX (without condition)
    // =========================================================================
    // Pattern: <MessengerWidget />  or  <MessengerWidget prop={...} />
    const standaloneRenderRegex = /<MessengerWidget\s*[^>]*\/>/g;
    if (standaloneRenderRegex.test(newContent)) {
      newContent = newContent.replace(standaloneRenderRegex, '{/* [SELF-HOSTED] MessengerWidget removed */}');
      log.ok('Removed standalone MessengerWidget JSX');
      modified = true;
    }

    // =========================================================================
    // 4. Remove messenger CSS imports (if any)
    // =========================================================================
    const messengerCssRegex = /^import\s+["'][^"']*messenger[^"']*\.css["'];?\s*$/gmi;
    if (messengerCssRegex.test(newContent)) {
      newContent = newContent.replace(messengerCssRegex, '// [SELF-HOSTED] Messenger CSS removed');
      log.ok('Removed messenger CSS import');
      modified = true;
    }

    // =========================================================================
    // Save changes
    // =========================================================================
    if (modified) {
      fs.writeFileSync(file, newContent);
      modifiedFiles++;
      log.info(`  Saved: ${relativePath}\n`);
    }
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log(`\n${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`${c.green}  Messenger Widget Removal Complete${c.reset}`);
  console.log(`${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`  Modified: ${c.green}${modifiedFiles}${c.reset} file(s)`);
  console.log(`\n${c.blue}REMOVED:${c.reset}`);
  console.log(`  • MessengerWidget imports from layout files`);
  console.log(`  • MessengerWidget JSX rendering (conditional & standalone)`);
  console.log(`  • Messenger CSS imports (if present)`);
  console.log(`${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

  if (modifiedFiles === 0) {
    log.warn('No MessengerWidget references found.');
    log.warn('The widget may not be present in this Cap version (added in v0.4.7+).');
  }
}

main().catch(err => {
  log.err(`Patch failed: ${err.message}`);
  console.error(err);
  process.exit(1);
});
