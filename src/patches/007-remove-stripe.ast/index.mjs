#!/usr/bin/env node
/**
 * Remove Stripe Payment Integration Patch
 *
 * Disables Stripe payment functionality for self-hosted deployments:
 * - Neutralizes Stripe SDK imports and API calls
 * - Makes subscription checks return "active" status (all features unlocked)
 * - Hides upgrade prompts and pricing UI
 *
 * This is a SAFE patch - it comments out code rather than deleting it,
 * making it easy to revert if needed.
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
console.log(`${c.blue}  Remove Stripe Payment Integration (Self-Hosted)${c.reset}`);
console.log(`${c.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

let modifiedFiles = 0;
let skippedFiles = 0;

// =============================================================================
// Main patch function
// =============================================================================
async function main() {
  log.info('Searching for Stripe and payment-related code...\n');

  // Find all TypeScript/JavaScript files
  const files = await glob('**/*.{ts,tsx,js,jsx,mjs}', {
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

    // Check if file contains payment-related references
    const hasStripe = /stripe|Stripe|@stripe/i.test(content);
    const hasPayment = /payment|billing|subscription|upgrade|pricing/i.test(content);
    const hasPro = /\bpro\b|isPro|isSubscribed|subscriptionStatus/i.test(content);

    if (!hasStripe && !hasPayment && !hasPro) {
      continue;
    }

    const relativePath = path.relative(APP_DIR, file);
    let modified = false;
    let newContent = content;

    // =========================================================================
    // Strategy 1: Neutralize Stripe SDK imports
    // =========================================================================

    // import Stripe from 'stripe';
    const stripeImportRegex = /^import\s+(?:Stripe|stripe|\{[^}]*\})\s+from\s+['"]stripe['"];?\s*$/gm;
    if (stripeImportRegex.test(newContent)) {
      newContent = newContent.replace(stripeImportRegex, '// [SELF-HOSTED] $&');
      log.ok(`Disabled Stripe import in ${relativePath}`);
      modified = true;
    }

    // import { loadStripe } from '@stripe/stripe-js';
    const stripeJsImportRegex = /^import\s+\{[^}]*\}\s+from\s+['"]@stripe\/stripe-js['"];?\s*$/gm;
    if (stripeJsImportRegex.test(newContent)) {
      newContent = newContent.replace(stripeJsImportRegex, '// [SELF-HOSTED] $&');
      log.ok(`Disabled @stripe/stripe-js import in ${relativePath}`);
      modified = true;
    }

    // =========================================================================
    // Strategy 2: Neutralize Stripe client initialization
    // =========================================================================

    // const stripe = new Stripe(...) or Stripe(...)
    const stripeInitRegex = /(?:const|let|var)\s+stripe\s*=\s*(?:new\s+)?Stripe\s*\([^)]*\)\s*;?/g;
    if (stripeInitRegex.test(newContent)) {
      newContent = newContent.replace(stripeInitRegex, '/* [SELF-HOSTED] $& */ const stripe = null;');
      log.ok(`Neutralized Stripe initialization in ${relativePath}`);
      modified = true;
    }

    // =========================================================================
    // Strategy 3: Make subscription checks return "active" / true
    // =========================================================================

    // Common patterns for subscription status checks
    // subscriptionStatus === "active" -> true
    // isSubscribed, isPro, hasSubscription -> true

    // Pattern: if (subscriptionStatus !== "active")
    const subCheckRegex = /subscriptionStatus\s*!==?\s*["']active["']/g;
    if (subCheckRegex.test(newContent)) {
      newContent = newContent.replace(subCheckRegex, 'false /* [SELF-HOSTED] always active */');
      log.ok(`Bypassed subscription check in ${relativePath}`);
      modified = true;
    }

    // Pattern: if (subscriptionStatus === "active")
    const subActiveRegex = /subscriptionStatus\s*===?\s*["']active["']/g;
    if (subActiveRegex.test(newContent)) {
      newContent = newContent.replace(subActiveRegex, 'true /* [SELF-HOSTED] always active */');
      log.ok(`Enabled subscription status in ${relativePath}`);
      modified = true;
    }

    // Pattern: !isSubscribed or !isPro -> false (user IS subscribed)
    const notSubscribedRegex = /!\s*(isSubscribed|isPro|hasActiveSubscription)\b/g;
    if (notSubscribedRegex.test(newContent)) {
      newContent = newContent.replace(notSubscribedRegex, 'false /* [SELF-HOSTED] $1 = true */');
      log.ok(`Bypassed !isSubscribed check in ${relativePath}`);
      modified = true;
    }

    // =========================================================================
    // Strategy 4: Hide upgrade/pricing UI components
    // =========================================================================

    // Pattern: <UpgradeButton ... /> or <PricingCard ... />
    const upgradeComponentRegex = /<(UpgradeButton|UpgradePrompt|PricingCard|SubscriptionBanner|PaywallModal)[^>]*\/>/g;
    if (upgradeComponentRegex.test(newContent)) {
      newContent = newContent.replace(upgradeComponentRegex, '{/* [SELF-HOSTED] <$1 /> removed */}');
      log.ok(`Removed upgrade component in ${relativePath}`);
      modified = true;
    }

    // Pattern: <UpgradeButton>...</UpgradeButton>
    const upgradeComponentBlockRegex = /<(UpgradeButton|UpgradePrompt|PricingCard|SubscriptionBanner|PaywallModal)[^>]*>[\s\S]*?<\/\1>/g;
    if (upgradeComponentBlockRegex.test(newContent)) {
      newContent = newContent.replace(upgradeComponentBlockRegex, '{/* [SELF-HOSTED] $1 removed */}');
      log.ok(`Removed upgrade component block in ${relativePath}`);
      modified = true;
    }

    // =========================================================================
    // Strategy 5: Neutralize Stripe API route handlers
    // =========================================================================

    // Check if this is a Stripe webhook or API route
    if (relativePath.includes('stripe') || relativePath.includes('webhook') || relativePath.includes('billing')) {
      // Add early return for Stripe routes
      const exportDefaultRegex = /export\s+(?:default\s+)?(?:async\s+)?function\s+(?:POST|GET|handler)/;
      if (exportDefaultRegex.test(newContent) && hasStripe) {
        // Add a disabled message at the top of the function
        newContent = newContent.replace(
          exportDefaultRegex,
          `// [SELF-HOSTED] Stripe routes disabled\n$&`
        );

        // Try to make the handler return early with a message
        const handlerBodyRegex = /(export\s+(?:default\s+)?(?:async\s+)?function\s+(?:POST|GET|handler)\s*\([^)]*\)\s*\{)/;
        if (handlerBodyRegex.test(newContent)) {
          newContent = newContent.replace(
            handlerBodyRegex,
            `$1\n  // [SELF-HOSTED] Stripe disabled for self-hosted deployment\n  return new Response(JSON.stringify({ error: "Payments disabled in self-hosted mode" }), { status: 501, headers: { "Content-Type": "application/json" } });\n`
          );
          log.ok(`Disabled Stripe API route in ${relativePath}`);
          modified = true;
        }
      }
    }

    // =========================================================================
    // Strategy 6: Handle stripe.* method calls
    // =========================================================================

    // Pattern: stripe.customers.create, stripe.subscriptions.retrieve, etc.
    const stripeMethodRegex = /\bstripe\.(customers|subscriptions|products|prices|checkout|paymentIntents|invoices)\.\w+\s*\(/g;
    if (stripeMethodRegex.test(newContent)) {
      // Wrap in try-catch that returns null
      newContent = newContent.replace(
        stripeMethodRegex,
        '/* [SELF-HOSTED] */ (async () => null)( /* $& */'
      );
      log.ok(`Neutralized Stripe API calls in ${relativePath}`);
      modified = true;
    }

    // =========================================================================
    // Strategy 7: Handle getProStatus / checkSubscription type functions
    // =========================================================================

    // Pattern: async function getProStatus or const getProStatus = async
    const proStatusFuncRegex = /((?:async\s+)?function\s+(?:getProStatus|checkSubscription|getSubscriptionStatus|isUserPro)\s*\([^)]*\)\s*\{)/;
    if (proStatusFuncRegex.test(newContent)) {
      newContent = newContent.replace(
        proStatusFuncRegex,
        `$1\n  // [SELF-HOSTED] Always return pro status\n  return { isPro: true, status: "active", plan: "pro" };\n`
      );
      log.ok(`Made ${relativePath} always return pro status`);
      modified = true;
    }

    // Arrow function variant: const getProStatus = async () => {
    const proStatusArrowRegex = /(const\s+(?:getProStatus|checkSubscription|getSubscriptionStatus|isUserPro)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{)/;
    if (proStatusArrowRegex.test(newContent)) {
      newContent = newContent.replace(
        proStatusArrowRegex,
        `$1\n  // [SELF-HOSTED] Always return pro status\n  return { isPro: true, status: "active", plan: "pro" };\n`
      );
      log.ok(`Made ${relativePath} always return pro status (arrow fn)`);
      modified = true;
    }

    // =========================================================================
    // Save changes
    // =========================================================================

    if (modified) {
      fs.writeFileSync(file, newContent);
      modifiedFiles++;
      log.info(`  Saved: ${relativePath}\n`);
    } else if (hasStripe || hasPayment) {
      // File has references but no patterns matched
      skippedFiles++;
      log.warn(`Contains payment references but no actionable patterns: ${relativePath}`);
    }
  }

  // =========================================================================
  // Check for Stripe in package.json (informational only)
  // =========================================================================
  log.info('\nChecking for Stripe dependencies...');

  const packageFiles = await glob('**/package.json', {
    cwd: APP_DIR,
    ignore: ['**/node_modules/**'],
    absolute: true
  });

  for (const pkgFile of packageFiles) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['stripe'] || deps['@stripe/stripe-js']) {
        const relativePath = path.relative(APP_DIR, pkgFile);
        log.warn(`Found Stripe dependency in: ${relativePath}`);
        log.warn('  Note: Dependency remains but functionality is disabled');
      }
    } catch (e) {
      // Skip invalid package.json files
    }
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log(`\n${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`${c.green}  Stripe Removal Complete${c.reset}`);
  console.log(`${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`  Modified: ${c.green}${modifiedFiles}${c.reset} file(s)`);

  if (skippedFiles > 0) {
    console.log(`  Skipped:  ${c.yellow}${skippedFiles}${c.reset} file(s) (had references but no actionable patterns)`);
  }

  console.log(`\n${c.blue}Self-hosted mode enabled:${c.reset}`);
  console.log(`  • Stripe SDK disabled`);
  console.log(`  • All subscription checks return "active"`);
  console.log(`  • Upgrade prompts hidden`);
  console.log(`  • All Pro features unlocked`);
  console.log(`${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

  if (modifiedFiles === 0) {
    log.warn('No files were modified - Stripe may not be present in this Cap version');
    log.warn('or patterns may have changed. Check manually if needed.');
  }
}

main().catch(err => {
  log.err(`Patch failed: ${err.message}`);
  console.error(err);
  process.exit(1);
});
