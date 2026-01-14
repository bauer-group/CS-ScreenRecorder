#!/usr/bin/env node
/**
 * Remove Stripe Payment Integration Patch
 *
 * Disables Stripe payment functionality for self-hosted deployments:
 * - Neutralizes Stripe SDK imports and API calls
 * - Makes subscription checks return "active" status (all features unlocked)
 * - Hides upgrade prompts and pricing UI
 * - Simulates an "unlimited Pro license" by making all relevant checks return
 * 
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

    // Pattern: stripeSubscriptionId checks in invite flow
    // Only replace the NEGATED check (!organizationOwner.stripeSubscriptionId) with false
    // Do NOT replace positive usages - those are actual value assignments that need the real value
    // Handles both regular access (.) and optional chaining (?.)
    const stripeSubIdCheckRegex = /!organizationOwner\??\.stripeSubscriptionId/g;
    if (stripeSubIdCheckRegex.test(newContent)) {
      newContent = newContent.replace(stripeSubIdCheckRegex, 'false /* [SELF-HOSTED] subscription not required */');
      log.ok(`Bypassed stripeSubscriptionId check in ${relativePath}`);
      modified = true;
    }

    // =========================================================================
    // Strategy 3b: UNLIMITED SEATS for self-hosted (simulate Pro license)
    // =========================================================================
    //
    // Target file: apps/web/utils/organization.ts
    // Actual code:
    //   const inviteQuota = organization?.inviteQuota ?? 1;
    //   const remainingSeats = buildEnv.NEXT_PUBLIC_IS_CAP
    //       ? Math.max(0, inviteQuota - totalUsedSeats)
    //       : Number.MAX_SAFE_INTEGER;

    // Fix 1: Replace the entire calculateSeats function to always return unlimited
    const calculateSeatsRegex = /export\s+function\s+calculateSeats\s*\([^)]*\)\s*\{[\s\S]*?^}/gm;
    if (calculateSeatsRegex.test(newContent)) {
      newContent = newContent.replace(calculateSeatsRegex, `export function calculateSeats(organization) {
  // [SELF-HOSTED] Unlimited Pro license simulation
  const memberCount = organization?.members?.length ?? 0;
  const pendingInvitesCount = organization?.invites?.length ?? 0;
  return {
    inviteQuota: Number.MAX_SAFE_INTEGER,
    memberCount,
    pendingInvitesCount,
    totalUsedSeats: memberCount + pendingInvitesCount,
    remainingSeats: Number.MAX_SAFE_INTEGER,
  };
}`);
      log.ok(`Replaced calculateSeats with unlimited version in ${relativePath}`);
      modified = true;
    }

    // Fix 2: Fallback - change default from 1 to MAX_SAFE_INTEGER
    const inviteQuotaDefaultRegex = /(organization\??\.inviteQuota\s*\?\?\s*)1(\s*;)/g;
    if (inviteQuotaDefaultRegex.test(newContent)) {
      newContent = newContent.replace(inviteQuotaDefaultRegex, (_, p1, p2) => `${p1}Number.MAX_SAFE_INTEGER${p2} /* [SELF-HOSTED] unlimited */`);
      log.ok(`Set invite quota to unlimited in ${relativePath}`);
      modified = true;
    }

    // =========================================================================
    // Strategy 3c: ENABLE ALL PRO FEATURES
    // =========================================================================

    // Pattern: isPro (positive check) -> true
    const isProPositiveRegex = /\b(isPro|isSubscribed|hasActiveSubscription|hasPro)\b(?!\s*[=:])/g;
    if (isProPositiveRegex.test(newContent) && !newContent.includes('[SELF-HOSTED]')) {
      // Only replace in conditional contexts, not declarations
      const conditionalProRegex = /(?:if\s*\(\s*|&&\s*|\|\|\s*|\?\s*|:\s*)(isPro|isSubscribed|hasActiveSubscription|hasPro)\b/g;
      if (conditionalProRegex.test(newContent)) {
        newContent = newContent.replace(conditionalProRegex, (match, varName) => {
          return match.replace(varName, `true /* [SELF-HOSTED] ${varName} */`);
        });
        log.ok(`Enabled Pro status in conditionals in ${relativePath}`);
        modified = true;
      }
    }

    // Pattern: user?.isPro or user.isPro -> true
    const userProRegex = /\b(user|currentUser|session)\??\.(isPro|isSubscribed|hasPro)\b/g;
    if (userProRegex.test(newContent)) {
      newContent = newContent.replace(userProRegex, 'true /* [SELF-HOSTED] Pro enabled */');
      log.ok(`Enabled user Pro status in ${relativePath}`);
      modified = true;
    }

    // Pattern: plan === "free" -> false (not on free plan)
    const freePlanRegex = /plan\s*===?\s*["']free["']/g;
    if (freePlanRegex.test(newContent)) {
      newContent = newContent.replace(freePlanRegex, 'false /* [SELF-HOSTED] Pro plan */');
      log.ok(`Bypassed free plan check in ${relativePath}`);
      modified = true;
    }

    // Pattern: plan !== "pro" -> false (is on pro plan)
    const notProPlanRegex = /plan\s*!==?\s*["']pro["']/g;
    if (notProPlanRegex.test(newContent)) {
      newContent = newContent.replace(notProPlanRegex, 'false /* [SELF-HOSTED] Pro plan */');
      log.ok(`Enabled pro plan check in ${relativePath}`);
      modified = true;
    }

    // Pattern: plan === "pro" -> true
    const proPlanRegex = /plan\s*===?\s*["']pro["']/g;
    if (proPlanRegex.test(newContent)) {
      newContent = newContent.replace(proPlanRegex, 'true /* [SELF-HOSTED] Pro plan */');
      log.ok(`Enabled pro plan in ${relativePath}`);
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

    // Pattern: "Manage Billing" button - only match buttons where the TEXT contains "Manage Billing"
    // We look for the text between > and </Button>, not just any billing reference in attributes
    // This is safer than matching based on onClick handlers which could match unrelated buttons
    const manageBillingButtonRegex = /<Button[^>]*>\s*(?:\{[^}]*\?\s*)?["']?Manage\s*Billing["']?\s*(?::[^}]*\})?\s*<\/Button>/gi;
    if (manageBillingButtonRegex.test(newContent)) {
      newContent = newContent.replace(manageBillingButtonRegex, '{/* [SELF-HOSTED] Manage Billing button removed */}');
      log.ok(`Removed Manage Billing button in ${relativePath}`);
      modified = true;
    }

    // Pattern: Billing Card component in BillingCard.tsx
    // Only match the specific BillingCard component file, not nested structures
    if (relativePath.includes('BillingCard.tsx')) {
      // Replace the entire Card that contains billing text
      const billingCardContentRegex = /<Card[^>]*>[\s\S]*?(?:View and manage your billing|billing details)[\s\S]*?<\/Card>/gi;
      if (billingCardContentRegex.test(newContent)) {
        newContent = newContent.replace(billingCardContentRegex, '{/* [SELF-HOSTED] Billing Card removed */}');
        log.ok(`Removed billing card content in ${relativePath}`);
        modified = true;
      }
    }

    // Pattern: Hide entire billing-related components
    const billingComponentRegex = /<(BillingCard|BillingSettings|ManageBilling|SubscriptionCard|BillingSection)[^>]*(?:\/>|>[\s\S]*?<\/\1>)/g;
    if (billingComponentRegex.test(newContent)) {
      newContent = newContent.replace(billingComponentRegex, '{/* [SELF-HOSTED] $1 removed */}');
      log.ok(`Removed billing component in ${relativePath}`);
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

  console.log(`\n${c.blue}UNLIMITED PRO LICENSE SIMULATION:${c.reset}`);
  console.log(`  • Stripe SDK disabled`);
  console.log(`  • All subscription checks return "active"`);
  console.log(`  • isPro / isSubscribed = true`);
  console.log(`  • plan = "pro" (not "free")`);
  console.log(`  • Seats: UNLIMITED (Number.MAX_SAFE_INTEGER)`);
  console.log(`  • Upgrade prompts hidden`);
  console.log(`  • All Pro features unlocked (transcript, summary, chapters)`);
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
