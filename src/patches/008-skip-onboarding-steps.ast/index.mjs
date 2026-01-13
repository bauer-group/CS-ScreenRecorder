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
  log.info('Searching for onboarding-related code...\n');

  // Find all TypeScript/JavaScript files in onboarding paths
  const files = await glob('**/*.{ts,tsx,js,jsx}', {
    cwd: APP_DIR,
    ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
    absolute: true
  });

  log.info(`Found ${files.length} source files to scan\n`);

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (e) {
      continue;
    }

    // Check if file contains onboarding-related references
    const hasOnboarding = /onboarding|OnBoarding/i.test(content);
    const hasSteps = /custom.*domain|invite.*team|organization.*setup/i.test(content);
    const hasStepConfig = /steps?\s*[=:]\s*\[|stepIndex|currentStep|activeStep/i.test(content);

    if (!hasOnboarding && !hasSteps && !hasStepConfig) {
      continue;
    }

    const relativePath = path.relative(APP_DIR, file);
    let modified = false;
    let newContent = content;

    // =========================================================================
    // Strategy 1: Replace Custom Domain step content with auto-skip
    // =========================================================================

    // Pattern: Step that shows "Custom Domain" UI
    // Replace the entire step content to auto-skip to next step
    const customDomainComponentRegex = /(function|const)\s+(CustomDomain|CustomDomainStep|DomainStep)\s*[=:]/;
    if (customDomainComponentRegex.test(newContent)) {
      log.info(`Found Custom Domain component in: ${relativePath}`);

      // Replace component to auto-advance
      const autoSkipComponent = `
// [SELF-HOSTED] Custom Domain step auto-skipped
const CustomDomainAutoSkip = ({ onNext, onSkip }) => {
  React.useEffect(() => {
    // Auto-skip this step for self-hosted
    const skip = onSkip || onNext;
    if (skip) skip();
  }, [onNext, onSkip]);
  return null;
};
`;
      // Try to add auto-skip behavior
      newContent = newContent.replace(
        /(["']Custom Domain["'])/gi,
        '"" /* [SELF-HOSTED] Custom Domain skipped */'
      );
      modified = true;
      log.ok('Neutralized Custom Domain references');
    }

    // =========================================================================
    // Strategy 2: Replace Invite Team step content with auto-skip
    // =========================================================================

    const inviteTeamComponentRegex = /(function|const)\s+(InviteTeam|InviteTeamStep|TeamInvite)\s*[=:]/;
    if (inviteTeamComponentRegex.test(newContent)) {
      log.info(`Found Invite Team component in: ${relativePath}`);

      newContent = newContent.replace(
        /(["']Invite your team["']|["']Invite Team["'])/gi,
        '"" /* [SELF-HOSTED] Invite Team skipped */'
      );
      modified = true;
      log.ok('Neutralized Invite Team references');
    }

    // =========================================================================
    // Strategy 3: Modify steps array to remove these steps
    // =========================================================================

    // Pattern: Steps array containing these step names
    // ["welcome", "organization", "custom-domain", "invite", "download"]
    const stepsArrayPatterns = [
      // Remove "custom-domain" or "customDomain" from array
      /,?\s*["']custom[-_]?domain["']\s*,?/gi,
      // Remove "invite-team" or "inviteTeam" from array
      /,?\s*["']invite[-_]?team["']\s*,?/gi,
      // Remove "invite" step (if standalone)
      /,?\s*["']invite["']\s*,?/gi,
      // Remove "domain" step (if standalone)
      /,?\s*["']domain["']\s*,?/gi,
    ];

    for (const pattern of stepsArrayPatterns) {
      if (pattern.test(newContent)) {
        newContent = newContent.replace(pattern, (match) => {
          // Keep one comma if between items
          return match.includes(',') ? ',' : '';
        });
        modified = true;
        log.ok(`Removed step from array pattern: ${pattern.source}`);
      }
    }

    // Clean up double commas from removal
    newContent = newContent.replace(/,\s*,/g, ',');
    newContent = newContent.replace(/\[\s*,/g, '[');
    newContent = newContent.replace(/,\s*\]/g, ']');

    // =========================================================================
    // Strategy 4: Modify step index navigation
    // =========================================================================

    // Pattern: if (currentStep === 2) -> skip to step 4 (Download)
    // This handles numeric step navigation
    const stepNavRegex = /setStep\s*\(\s*(\d+)\s*\)/g;
    // We'll handle this more carefully if we find specific patterns

    // =========================================================================
    // Strategy 5: Hide steps in stepper/progress UI
    // =========================================================================

    // Pattern: Step config objects with label/title
    // { label: "Custom Domain", ... } -> skip or hide

    // Hide Custom Domain step in UI
    const customDomainStepObjRegex = /\{\s*(?:[^{}]*,)?\s*(?:label|title|name)\s*:\s*["']Custom Domain["'][^}]*\}/gi;
    if (customDomainStepObjRegex.test(newContent)) {
      newContent = newContent.replace(customDomainStepObjRegex, '/* [SELF-HOSTED] Custom Domain step removed */ { skip: true, hidden: true }');
      modified = true;
      log.ok('Removed Custom Domain step config');
    }

    // Hide Invite Team step in UI
    const inviteTeamStepObjRegex = /\{\s*(?:[^{}]*,)?\s*(?:label|title|name)\s*:\s*["']Invite (?:your )?team["'][^}]*\}/gi;
    if (inviteTeamStepObjRegex.test(newContent)) {
      newContent = newContent.replace(inviteTeamStepObjRegex, '/* [SELF-HOSTED] Invite Team step removed */ { skip: true, hidden: true }');
      modified = true;
      log.ok('Removed Invite Team step config');
    }

    // =========================================================================
    // Strategy 6: Return null/skip for step content render
    // =========================================================================

    // Pattern: case "custom-domain": return <CustomDomain />
    const switchCaseCustomDomainRegex = /case\s+["']custom[-_]?domain["']\s*:\s*return\s+[^;]+;/gi;
    if (switchCaseCustomDomainRegex.test(newContent)) {
      newContent = newContent.replace(switchCaseCustomDomainRegex, 'case "custom-domain": return null; /* [SELF-HOSTED] skipped */');
      modified = true;
      log.ok('Bypassed Custom Domain case');
    }

    const switchCaseInviteRegex = /case\s+["']invite[-_]?team["']\s*:\s*return\s+[^;]+;/gi;
    if (switchCaseInviteRegex.test(newContent)) {
      newContent = newContent.replace(switchCaseInviteRegex, 'case "invite-team": return null; /* [SELF-HOSTED] skipped */');
      modified = true;
      log.ok('Bypassed Invite Team case');
    }

    // =========================================================================
    // Strategy 7: Handle step number constants
    // =========================================================================

    // Pattern: CUSTOM_DOMAIN_STEP = 3, INVITE_STEP = 4
    const stepConstantRegex = /(CUSTOM_DOMAIN_STEP|DOMAIN_STEP|INVITE_STEP|INVITE_TEAM_STEP)\s*=\s*\d+/gi;
    if (stepConstantRegex.test(newContent)) {
      newContent = newContent.replace(stepConstantRegex, '$1 = -1 /* [SELF-HOSTED] disabled */');
      modified = true;
      log.ok('Disabled step constants');
    }

    // =========================================================================
    // Strategy 8: Auto-skip in step component with useEffect
    // =========================================================================

    // Look for onboarding step components and add auto-skip
    // This handles cases where the component is rendered but should immediately skip

    // Pattern: export function CustomDomain or export const CustomDomain
    const customDomainExportRegex = /export\s+(function|const)\s+CustomDomain/;
    if (customDomainExportRegex.test(newContent)) {
      // Add early return to skip rendering
      newContent = newContent.replace(
        /(export\s+(?:function|const)\s+CustomDomain[^{]*\{)/,
        `$1\n  // [SELF-HOSTED] Auto-skip Custom Domain step\n  return null;\n  /* Original code below disabled:\n`
      );
      // Close the comment at the end of function (simplified)
      modified = true;
      log.ok('Added auto-skip to Custom Domain export');
    }

    // =========================================================================
    // Strategy 9: Filter steps in map/render
    // =========================================================================

    // Pattern: steps.map((step) => ...) - filter out skipped steps
    // Add filter before map if steps array is used
    const stepsMapRegex = /(steps)\.map\s*\(/g;
    if (stepsMapRegex.test(newContent) && (content.includes('Custom Domain') || content.includes('Invite'))) {
      newContent = newContent.replace(
        stepsMapRegex,
        '$1.filter(s => !s.skip && !s.hidden).map('
      );
      modified = true;
      log.ok('Added filter to steps.map()');
    }

    // =========================================================================
    // Strategy 10: Direct text replacement for step labels in array
    // =========================================================================

    // If we find an array with these labels, mark them for filtering
    if (newContent.includes('"Custom Domain"') || newContent.includes("'Custom Domain'")) {
      // Add a skip property or remove entirely
      newContent = newContent.replace(
        /\{\s*([^}]*)(["']Custom Domain["'])([^}]*)\}/g,
        '{ $1$2$3, skip: true, hidden: true }'
      );
      modified = true;
      log.ok('Marked Custom Domain step for skip');
    }

    if (newContent.includes('"Invite your team"') || newContent.includes("'Invite your team'")) {
      newContent = newContent.replace(
        /\{\s*([^}]*)(["']Invite your team["'])([^}]*)\}/g,
        '{ $1$2$3, skip: true, hidden: true }'
      );
      modified = true;
      log.ok('Marked Invite your team step for skip');
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
    log.warn('Check manually if needed: apps/web/app/onboarding or similar');
  }
}

main().catch(err => {
  log.err(`Patch failed: ${err.message}`);
  console.error(err);
  process.exit(1);
});
