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
// Helper: Check if file should be skipped (database, schema, etc.)
// =============================================================================
function shouldSkipFile(relativePath) {
  const skipPatterns = [
    /schema\.(ts|js)$/i,
    /database/i,
    /migrations?/i,
    /drizzle/i,
    /prisma/i,
    /\.sql$/i,
    /seed\.(ts|js)$/i,
  ];

  return skipPatterns.some(pattern => pattern.test(relativePath));
}

// =============================================================================
// Main patch function
// =============================================================================
async function main() {
  log.info('Searching for onboarding-related code...\n');

  // Find files specifically in onboarding directories first
  const onboardingFiles = await glob('**/onboarding/**/*.{ts,tsx,js,jsx}', {
    cwd: APP_DIR,
    ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**'],
    absolute: true
  });

  // Also find files that might contain onboarding step definitions
  const otherFiles = await glob('**/*.{ts,tsx,js,jsx}', {
    cwd: APP_DIR,
    ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/onboarding/**'],
    absolute: true
  });

  log.info(`Found ${onboardingFiles.length} files in onboarding directories`);
  log.info(`Found ${otherFiles.length} other source files to scan\n`);

  // Process onboarding files first (more aggressive patching)
  for (const file of onboardingFiles) {
    await processOnboardingFile(file, true);
  }

  // Process other files (conservative patching - only step configs)
  for (const file of otherFiles) {
    const relativePath = path.relative(APP_DIR, file);

    // Skip database/schema files entirely
    if (shouldSkipFile(relativePath)) {
      continue;
    }

    await processOnboardingFile(file, false);
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

// =============================================================================
// Process a single file
// =============================================================================
async function processOnboardingFile(file, isOnboardingDir) {
  let content;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return;
  }

  const relativePath = path.relative(APP_DIR, file);

  // For non-onboarding files, only process if it has step config patterns
  if (!isOnboardingDir) {
    const hasStepConfig = /steps?\s*[=:]\s*\[.*(?:Custom Domain|Invite)/is.test(content);
    if (!hasStepConfig) {
      return;
    }
  }

  let modified = false;
  let newContent = content;

  // =========================================================================
  // Strategy 1: Hide steps in stepper/progress UI (SAFE - exact match)
  // =========================================================================

  // Pattern: Step config objects with exact label "Custom Domain"
  // { label: "Custom Domain", ... } -> add skip: true
  const customDomainStepObjRegex = /(\{\s*(?:[^{}]*,)?\s*(?:label|title|name)\s*:\s*)(["']Custom Domain["'])([^}]*\})/gi;
  if (customDomainStepObjRegex.test(newContent)) {
    newContent = newContent.replace(customDomainStepObjRegex, '$1$2$3 /* [SELF-HOSTED] skipped */');
    modified = true;
    log.ok(`Marked Custom Domain step config in ${relativePath}`);
  }

  // Pattern: Step config objects with exact label "Invite your team"
  const inviteTeamStepObjRegex = /(\{\s*(?:[^{}]*,)?\s*(?:label|title|name)\s*:\s*)(["']Invite your team["'])([^}]*\})/gi;
  if (inviteTeamStepObjRegex.test(newContent)) {
    newContent = newContent.replace(inviteTeamStepObjRegex, '$1$2$3 /* [SELF-HOSTED] skipped */');
    modified = true;
    log.ok(`Marked Invite Team step config in ${relativePath}`);
  }

  // =========================================================================
  // Strategy 2: For onboarding files only - more aggressive patching
  // =========================================================================

  if (isOnboardingDir) {
    // Pattern: Step component that renders Custom Domain UI
    // Look for components/pages that render the Custom Domain step
    if (content.includes('Custom Domain') && content.includes('Upgrade to Pro')) {
      // This is likely the Custom Domain step - add auto-skip
      const useEffectPattern = /(useEffect\s*\(\s*\(\)\s*=>\s*\{)/;
      if (useEffectPattern.test(newContent) && !newContent.includes('[SELF-HOSTED]')) {
        // Add skip logic at the start
        newContent = newContent.replace(
          useEffectPattern,
          `$1\n    // [SELF-HOSTED] Auto-skip Custom Domain step\n    if (typeof onSkip === 'function') { onSkip(); return; }\n`
        );
        modified = true;
        log.ok(`Added auto-skip to Custom Domain in ${relativePath}`);
      }
    }

    // Pattern: Step component that renders Invite Team UI with pricing
    if (content.includes('Invite your team') && (content.includes('$') || content.includes('per user'))) {
      const useEffectPattern = /(useEffect\s*\(\s*\(\)\s*=>\s*\{)/;
      if (useEffectPattern.test(newContent) && !newContent.includes('[SELF-HOSTED]')) {
        newContent = newContent.replace(
          useEffectPattern,
          `$1\n    // [SELF-HOSTED] Auto-skip Invite Team step\n    if (typeof onSkip === 'function') { onSkip(); return; }\n`
        );
        modified = true;
        log.ok(`Added auto-skip to Invite Team in ${relativePath}`);
      }
    }

    // Pattern: Switch/case for step rendering
    // case 3: return <CustomDomain /> -> case 3: return null
    const caseCustomDomainRegex = /(case\s+\d+\s*:[\s\S]*?)(return\s+<\s*(?:CustomDomain|DomainStep)[^>]*\s*\/?>\s*;?)/gi;
    if (caseCustomDomainRegex.test(newContent)) {
      newContent = newContent.replace(caseCustomDomainRegex, '$1return null; /* [SELF-HOSTED] Custom Domain skipped */');
      modified = true;
      log.ok(`Bypassed Custom Domain case in ${relativePath}`);
    }

    const caseInviteRegex = /(case\s+\d+\s*:[\s\S]*?)(return\s+<\s*(?:InviteTeam|TeamInvite|InviteStep)[^>]*\s*\/?>\s*;?)/gi;
    if (caseInviteRegex.test(newContent)) {
      newContent = newContent.replace(caseInviteRegex, '$1return null; /* [SELF-HOSTED] Invite Team skipped */');
      modified = true;
      log.ok(`Bypassed Invite Team case in ${relativePath}`);
    }

    // Pattern: Conditional rendering with step index
    // {step === 3 && <CustomDomain />} -> {step === 3 && null}
    const conditionalCustomDomainRegex = /(\{[^}]*step\s*===?\s*\d+\s*&&\s*)<\s*(?:CustomDomain|DomainStep)[^}]*\/?\s*>\s*\}/gi;
    if (conditionalCustomDomainRegex.test(newContent)) {
      newContent = newContent.replace(conditionalCustomDomainRegex, '$1null /* [SELF-HOSTED] */ }');
      modified = true;
      log.ok(`Removed conditional Custom Domain render in ${relativePath}`);
    }

    const conditionalInviteRegex = /(\{[^}]*step\s*===?\s*\d+\s*&&\s*)<\s*(?:InviteTeam|TeamInvite|InviteStep)[^}]*\/?\s*>\s*\}/gi;
    if (conditionalInviteRegex.test(newContent)) {
      newContent = newContent.replace(conditionalInviteRegex, '$1null /* [SELF-HOSTED] */ }');
      modified = true;
      log.ok(`Removed conditional Invite Team render in ${relativePath}`);
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

main().catch(err => {
  log.err(`Patch failed: ${err.message}`);
  console.error(err);
  process.exit(1);
});
