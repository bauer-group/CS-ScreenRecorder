#!/usr/bin/env node
/**
 * Skip Onboarding Steps Patch (Self-Hosted)
 *
 * Removes "Custom Domain" and "Invite your team" onboarding steps
 * which are irrelevant for self-hosted deployments:
 *   - Custom Domain: Requires Pro subscription (already unlocked)
 *   - Invite Team: Shows pricing/billing UI (not applicable)
 *
 * Original flow: Welcome → Organization Setup → Custom Domain → Invite Team → Download
 * Patched flow:  Welcome → Organization Setup → Download
 *
 * Strategy: Modify navigation in OrganizationSetupPage to skip directly to Download
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const APP_DIR = process.env.APP_DIR || '/app';

// Colors
const c = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', reset: '\x1b[0m'
};

const log = {
  info: (msg) => console.log(`${c.blue}${msg}${c.reset}`),
  ok: (msg) => console.log(`${c.green}  ✓ ${msg}${c.reset}`),
  warn: (msg) => console.log(`${c.yellow}  • ${msg}${c.reset}`),
  err: (msg) => console.log(`${c.red}  ✗ ${msg}${c.reset}`),
  debug: (msg) => console.log(`${c.cyan}  [DEBUG] ${msg}${c.reset}`)
};

console.log(`${c.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
console.log(`${c.blue}  Skip Onboarding Steps (Self-Hosted)${c.reset}`);
console.log(`${c.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

let modifiedFiles = 0;

// =============================================================================
// Main patch function
// =============================================================================
async function main() {
  log.info('Searching for onboarding components...\n');

  // Find onboarding component files
  const files = await glob('**/onboarding/**/*.{ts,tsx}', {
    cwd: APP_DIR,
    ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
    absolute: true
  });

  log.info(`Found ${files.length} files in onboarding directories\n`);

  for (const file of files) {
    const relativePath = path.relative(APP_DIR, file);
    const filename = path.basename(file);

    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (e) {
      continue;
    }

    let modified = false;
    let newContent = content;

    // =========================================================================
    // Strategy 1: OrganizationSetupPage - skip to /onboarding/download
    // =========================================================================
    if (filename === 'OrganizationSetupPage.tsx' || relativePath.includes('organization-setup')) {
      // Change: router.push("/onboarding/custom-domain") -> router.push("/onboarding/download")
      if (newContent.includes('/onboarding/custom-domain')) {
        newContent = newContent.replace(
          /["']\/onboarding\/custom-domain["']/g,
          '"/onboarding/download" /* [SELF-HOSTED] skip to download */'
        );
        log.ok(`Patched OrganizationSetupPage to skip to download`);
        modified = true;
      }
    }

    // =========================================================================
    // Strategy 2: Stepper - remove Custom Domain and Invite Team from steps
    // =========================================================================
    if (filename === 'Stepper.tsx') {
      // Remove "Custom Domain" step from steps array
      const customDomainStepRegex = /\{\s*label:\s*["']Custom Domain["'][^}]*\}\s*,?/g;
      if (customDomainStepRegex.test(newContent)) {
        newContent = newContent.replace(customDomainStepRegex, '/* [SELF-HOSTED] Custom Domain removed */');
        log.ok(`Removed "Custom Domain" from Stepper`);
        modified = true;
      }

      // Remove "Invite your team" step from steps array
      const inviteTeamStepRegex = /\{\s*label:\s*["']Invite your team["'][^}]*\}\s*,?/g;
      if (inviteTeamStepRegex.test(newContent)) {
        newContent = newContent.replace(inviteTeamStepRegex, '/* [SELF-HOSTED] Invite Team removed */');
        log.ok(`Removed "Invite your team" from Stepper`);
        modified = true;
      }

      // Fix step index mapping for download (was index 4, now index 2)
      // "/onboarding/download": 4 -> "/onboarding/download": 2
      if (newContent.includes('"/onboarding/download": 4')) {
        newContent = newContent.replace(
          '"/onboarding/download": 4',
          '"/onboarding/download": 2 /* [SELF-HOSTED] adjusted index */'
        );
        log.ok(`Adjusted download step index in Stepper`);
        modified = true;
      }

      // Remove step index mappings for removed steps
      const customDomainIndexRegex = /["']\/onboarding\/custom-domain["']\s*:\s*\d+\s*,?/g;
      if (customDomainIndexRegex.test(newContent)) {
        newContent = newContent.replace(customDomainIndexRegex, '/* [SELF-HOSTED] removed */');
        modified = true;
      }

      const inviteTeamIndexRegex = /["']\/onboarding\/invite-team["']\s*:\s*\d+\s*,?/g;
      if (inviteTeamIndexRegex.test(newContent)) {
        newContent = newContent.replace(inviteTeamIndexRegex, '/* [SELF-HOSTED] removed */');
        modified = true;
      }
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
  console.log(`${c.green}  Onboarding Steps Patch Complete${c.reset}`);
  console.log(`${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`  Modified: ${c.green}${modifiedFiles}${c.reset} file(s)`);
  console.log(`\n${c.blue}ONBOARDING FLOW CHANGES:${c.reset}`);
  console.log(`  • Original: Welcome → Org Setup → Custom Domain → Invite Team → Download`);
  console.log(`  • Patched:  Welcome → Org Setup → Download`);
  console.log(`\n${c.blue}REMOVED STEPS:${c.reset}`);
  console.log(`  • Custom Domain (requires Pro subscription - N/A for self-hosted)`);
  console.log(`  • Invite your team (shows pricing UI - N/A for self-hosted)`);
  console.log(`${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

  if (modifiedFiles === 0) {
    log.warn('No onboarding files were modified.');
    log.warn('The onboarding flow may have changed in this Cap version.');
    log.warn('Check manually: apps/web/app/(org)/onboarding/components/');
  }
}

main().catch(err => {
  log.err(`Patch failed: ${err.message}`);
  console.error(err);
  process.exit(1);
});
