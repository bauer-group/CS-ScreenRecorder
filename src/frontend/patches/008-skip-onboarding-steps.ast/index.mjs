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
 * Cap v0.4.6 Stepper format:
 *   steps = [{ id: "1", name: "Welcome", completed: ... }, ...]
 *   currentStep detection via usePathname()
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

      // --- v0.4.6 format: { id: "3", name: "Custom Domain", completed: ... } ---
      // Remove "Custom Domain" step object from steps array
      const customDomainNameRegex = /\{\s*id:\s*["']\d["'],\s*name:\s*["']Custom Domain["'],\s*completed:[^}]*\}\s*,?/g;
      if (customDomainNameRegex.test(newContent)) {
        newContent = newContent.replace(customDomainNameRegex, '/* [SELF-HOSTED] Custom Domain removed */');
        log.ok(`Removed "Custom Domain" step from Stepper (v0.4.6 format)`);
        modified = true;
      }

      // Remove "Invite your team" step object from steps array
      const inviteTeamNameRegex = /\{\s*id:\s*["']\d["'],\s*name:\s*["']Invite your team["'],\s*completed:[^}]*\}\s*,?/g;
      if (inviteTeamNameRegex.test(newContent)) {
        newContent = newContent.replace(inviteTeamNameRegex, '/* [SELF-HOSTED] Invite Team removed */');
        log.ok(`Removed "Invite your team" step from Stepper (v0.4.6 format)`);
        modified = true;
      }

      // --- Fallback: older format with label: instead of name: ---
      const customDomainLabelRegex = /\{\s*label:\s*["']Custom Domain["'][^}]*\}\s*,?/g;
      if (customDomainLabelRegex.test(newContent)) {
        newContent = newContent.replace(customDomainLabelRegex, '/* [SELF-HOSTED] Custom Domain removed */');
        log.ok(`Removed "Custom Domain" step from Stepper (legacy format)`);
        modified = true;
      }

      const inviteTeamLabelRegex = /\{\s*label:\s*["']Invite your team["'][^}]*\}\s*,?/g;
      if (inviteTeamLabelRegex.test(newContent)) {
        newContent = newContent.replace(inviteTeamLabelRegex, '/* [SELF-HOSTED] Invite Team removed */');
        log.ok(`Removed "Invite your team" step from Stepper (legacy format)`);
        modified = true;
      }

      // Fix Download step id: "5" -> "3" (after removing 2 steps)
      // Match: id: "5", name: "Download"
      const downloadIdRegex = /id:\s*["']5["'](\s*,\s*name:\s*["']Download["'])/g;
      if (downloadIdRegex.test(newContent)) {
        newContent = newContent.replace(downloadIdRegex, 'id: "3"$1');
        log.ok(`Fixed Download step id: "5" → "3"`);
        modified = true;
      }

      // Remove currentStep path mappings for removed steps (v0.4.6 uses usePathname)
      // Remove: if (currentPath === "/onboarding/custom-domain") return "Custom Domain";
      const customDomainPathRegex = /\s*if\s*\(\s*currentPath\s*===\s*["']\/onboarding\/custom-domain["']\s*\)\s*return\s*["']Custom Domain["'];?/g;
      if (customDomainPathRegex.test(newContent)) {
        newContent = newContent.replace(customDomainPathRegex, '\n\t\t/* [SELF-HOSTED] Custom Domain path removed */');
        log.ok(`Removed Custom Domain path mapping from Stepper`);
        modified = true;
      }

      // Remove: if (currentPath === "/onboarding/invite-team") return "Invite your team";
      const inviteTeamPathRegex = /\s*if\s*\(\s*currentPath\s*===\s*["']\/onboarding\/invite-team["']\s*\)\s*return\s*["']Invite your team["'];?/g;
      if (inviteTeamPathRegex.test(newContent)) {
        newContent = newContent.replace(inviteTeamPathRegex, '\n\t\t/* [SELF-HOSTED] Invite Team path removed */');
        log.ok(`Removed Invite Team path mapping from Stepper`);
        modified = true;
      }

      // Fix MobileStepper step count: "Step X/5" -> "Step X/3"
      // Replace hardcoded step count
      if (newContent.includes('/5')) {
        newContent = newContent.replace(
          /\{activeStep\.id\}\/5/g,
          '{activeStep.id}/3 /* [SELF-HOSTED] 3 steps */'
        );
        log.ok(`Fixed MobileStepper step count: 5 → 3`);
        modified = true;
      }

      // Remove completedSteps properties for removed steps (type interface)
      // Remove: customDomain?: boolean;
      const customDomainPropRegex = /\s*customDomain\??\s*:\s*boolean;?/g;
      if (customDomainPropRegex.test(newContent)) {
        newContent = newContent.replace(customDomainPropRegex, '\n\t\t/* [SELF-HOSTED] customDomain removed */');
        modified = true;
      }

      // Remove: inviteTeam?: boolean;
      const inviteTeamPropRegex = /\s*inviteTeam\??\s*:\s*boolean;?/g;
      if (inviteTeamPropRegex.test(newContent)) {
        newContent = newContent.replace(inviteTeamPropRegex, '\n\t\t/* [SELF-HOSTED] inviteTeam removed */');
        modified = true;
      }

      // --- Legacy: Remove step index mappings (pre-v0.4.6) ---
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

      // Legacy: Fix download index mapping
      if (newContent.includes('"/onboarding/download": 4')) {
        newContent = newContent.replace(
          '"/onboarding/download": 4',
          '"/onboarding/download": 2 /* [SELF-HOSTED] adjusted index */'
        );
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
