#!/usr/bin/env node
/**
 * Remove Intercom/Fin Chat Widget Patch
 *
 * Removes the Intercom messenger SDK integration to disable the
 * Fin chat widget that appears in the bottom right corner.
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
  err: (msg) => console.log(`${c.red}  ✗ ${msg}${c.reset}`),
  debug: (msg) => console.log(`${c.yellow}  [DEBUG] ${msg}${c.reset}`)
};

console.log(`${c.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
console.log(`${c.blue}  Remove Intercom/Fin Chat Widget Patch${c.reset}`);
console.log(`${c.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

let modified = 0;
let skipped = 0;

// =============================================================================
// Find and patch files containing Intercom references
// =============================================================================
async function main() {
  log.info('Searching for Intercom references...');

  // Find all TypeScript/JavaScript files
  const files = await glob('**/*.{ts,tsx,js,jsx,mjs}', {
    cwd: APP_DIR,
    ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
    absolute: true
  });

  log.info(`Found ${files.length} source files to scan`);

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (e) {
      continue;
    }

    // Check if file contains Intercom references
    if (!content.includes('intercom') && !content.includes('Intercom') && !content.includes('@intercom')) {
      continue;
    }

    const relativePath = path.relative(APP_DIR, file);
    log.info(`Processing: ${relativePath}`);

    let modified_file = false;
    let newContent = content;

    // Strategy 1: Remove @intercom/messenger-js-sdk imports entirely
    // Match: import { ... } from "@intercom/messenger-js-sdk";
    // Match: import Intercom from "@intercom/messenger-js-sdk";
    const intercomImportRegex = /^import\s+.*from\s+["']@intercom\/messenger-js-sdk["'];?\s*$/gm;
    if (intercomImportRegex.test(newContent)) {
      newContent = newContent.replace(intercomImportRegex, '// [REMOVED] Intercom import disabled by patch');
      log.ok('Removed @intercom/messenger-js-sdk import');
      modified_file = true;
    }

    // Strategy 2: Comment out Intercom.boot() or Intercom() calls
    // Match: Intercom({ ... });
    // Match: Intercom.boot({ ... });
    const intercomCallRegex = /Intercom\s*\(\s*\{[\s\S]*?\}\s*\)\s*;?/g;
    if (intercomCallRegex.test(newContent)) {
      newContent = newContent.replace(intercomCallRegex, '/* [REMOVED] Intercom call disabled by patch */');
      log.ok('Removed Intercom() call');
      modified_file = true;
    }

    // Strategy 3: Neutralize useIntercom hook usage
    // Look for patterns like: const { boot, show } = useIntercom();
    const useIntercomRegex = /const\s+\{[^}]*\}\s*=\s*useIntercom\s*\(\s*\)\s*;?/g;
    if (useIntercomRegex.test(newContent)) {
      newContent = newContent.replace(useIntercomRegex, '// [REMOVED] useIntercom disabled by patch');
      log.ok('Removed useIntercom() hook');
      modified_file = true;
    }

    // Strategy 4: Remove IntercomProvider wrapper
    // Match: <IntercomProvider ... > ... </IntercomProvider>
    const intercomProviderRegex = /<IntercomProvider[^>]*>[\s\S]*?<\/IntercomProvider>/g;
    if (intercomProviderRegex.test(newContent)) {
      // Replace provider with just its children (simplified - extracts inner content)
      newContent = newContent.replace(intercomProviderRegex, (match) => {
        // Try to extract children
        const childMatch = match.match(/<IntercomProvider[^>]*>([\s\S]*?)<\/IntercomProvider>/);
        if (childMatch && childMatch[1]) {
          return childMatch[1].trim();
        }
        return '/* [REMOVED] IntercomProvider disabled by patch */';
      });
      log.ok('Removed IntercomProvider');
      modified_file = true;
    }

    // Strategy 5: Remove import of IntercomProvider
    const intercomProviderImportRegex = /^import\s+.*IntercomProvider.*from\s+["'][^"']+["'];?\s*$/gm;
    if (intercomProviderImportRegex.test(newContent)) {
      newContent = newContent.replace(intercomProviderImportRegex, '// [REMOVED] IntercomProvider import disabled by patch');
      log.ok('Removed IntercomProvider import');
      modified_file = true;
    }

    // Strategy 6: Comment out boot() calls from destructured useIntercom
    const bootCallRegex = /\bboot\s*\(\s*\{[\s\S]*?\}\s*\)\s*;?/g;
    if (content.includes('useIntercom') && bootCallRegex.test(newContent)) {
      newContent = newContent.replace(bootCallRegex, '/* [REMOVED] Intercom boot disabled by patch */');
      log.ok('Removed boot() call');
      modified_file = true;
    }

    // Strategy 7: Handle inline Intercom initialization in useEffect
    // Pattern: useEffect(() => { ... Intercom ... }, [])
    const useEffectIntercomRegex = /useEffect\s*\(\s*\(\)\s*=>\s*\{[^}]*Intercom[^}]*\}\s*,\s*\[[^\]]*\]\s*\)/g;
    if (useEffectIntercomRegex.test(newContent)) {
      newContent = newContent.replace(useEffectIntercomRegex, 'useEffect(() => { /* [REMOVED] Intercom initialization disabled by patch */ }, [])');
      log.ok('Neutralized Intercom useEffect');
      modified_file = true;
    }

    if (modified_file) {
      fs.writeFileSync(file, newContent);
      log.ok(`Saved: ${relativePath}`);
      modified++;
    } else {
      log.warn(`Contains 'intercom' but no actionable patterns: ${relativePath}`);
      skipped++;
    }
  }

  // Also check package.json files for @intercom dependency (informational)
  const packageFiles = await glob('**/package.json', {
    cwd: APP_DIR,
    ignore: ['**/node_modules/**'],
    absolute: true
  });

  for (const pkgFile of packageFiles) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['@intercom/messenger-js-sdk']) {
        const relativePath = path.relative(APP_DIR, pkgFile);
        log.warn(`Found @intercom/messenger-js-sdk dependency in: ${relativePath}`);
        log.warn('Note: Dependency remains in package.json but imports are disabled');
      }
    } catch (e) {
      // Skip invalid package.json files
    }
  }

  // Summary
  console.log(`\n${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`${c.green}  Complete: ${modified} file(s) modified${c.reset}`);
  if (skipped > 0) {
    console.log(`${c.yellow}  Skipped: ${skipped} file(s) contained 'intercom' but no actionable patterns${c.reset}`);
  }
  console.log(`${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

  if (modified === 0 && skipped === 0) {
    log.warn('No Intercom references found - widget may not be present in this Cap version');
  }
}

main().catch(err => {
  log.err(`Patch failed: ${err.message}`);
  process.exit(1);
});
