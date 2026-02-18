#!/usr/bin/env node
/**
 * Remove Stripe Payment Integration Patch
 *
 * Disables Stripe payment functionality for self-hosted deployments:
 * - Replaces Stripe utility with mock that returns null
 * - Makes subscription checks return "active" status (all features unlocked)
 * - Hides upgrade prompts and pricing UI
 * - Simulates an "unlimited Pro license"
 *
 * Compatible with Cap v0.3.x and v0.4.x
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
// Mock Stripe utility - replaces the real stripe.ts
// =============================================================================
const MOCK_STRIPE_TS = `// [SELF-HOSTED] Mock Stripe - all payments disabled, Pro features enabled

// Stripe is always "unavailable" in self-hosted mode
export const STRIPE_AVAILABLE = () => false;

// Create a recursive proxy that handles any method chain like stripe().customers.list()
// All methods return empty results instead of crashing
const createMockProxy = (): any => {
  const handler: ProxyHandler<any> = {
    get: (_target, prop) => {
      // Return mock data for common Stripe response properties
      if (prop === 'data') return [];
      if (prop === 'has_more') return false;
      if (prop === 'url') return null;
      if (prop === 'id') return 'mock_id';
      if (prop === 'then') return undefined; // Not a promise
      if (prop === 'catch') return undefined; // Not a promise
      if (prop === 'finally') return undefined; // Not a promise
      // Return another proxy for method chaining
      return createMockProxy();
    },
    apply: () => {
      // When called as a function, return a resolved promise with mock data
      // that covers all common Stripe response patterns
      return Promise.resolve({
        data: [],
        has_more: false,
        url: null,  // For billingPortal.sessions.create()
        id: 'mock_id',
        object: 'mock',
        status: 'active',
      });
    },
  };
  return new Proxy(function() {}, handler);
};

// stripe() returns the mock proxy - all calls are safely neutralized
export const stripe = () => createMockProxy();
`;

// =============================================================================
// Main patch function
// =============================================================================
async function main() {
  log.info('Searching for Stripe and payment-related code...\n');

  // =========================================================================
  // CRITICAL FIX: Replace stripe.ts with mock implementation
  // This prevents "Stripe is not defined" errors
  // =========================================================================
  const stripeUtilPaths = [
    path.join(APP_DIR, 'packages/utils/src/lib/stripe/stripe.ts'),
    path.join(APP_DIR, 'packages/utils/stripe.ts'),
  ];

  for (const stripePath of stripeUtilPaths) {
    if (fs.existsSync(stripePath)) {
      fs.writeFileSync(stripePath, MOCK_STRIPE_TS);
      log.ok(`Replaced stripe utility with mock: ${path.relative(APP_DIR, stripePath)}`);
      modifiedFiles++;
    }
  }

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

    // Skip the stripe utility we already replaced
    if (relativePath.includes('stripe/stripe.ts') || relativePath.includes('stripe.ts')) {
      continue;
    }

    let modified = false;
    let newContent = content;

    // =========================================================================
    // Strategy 1: Make subscription checks return "active" / true
    // =========================================================================

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
    const stripeSubIdCheckRegex = /!organizationOwner\??\.stripeSubscriptionId/g;
    if (stripeSubIdCheckRegex.test(newContent)) {
      newContent = newContent.replace(stripeSubIdCheckRegex, 'false /* [SELF-HOSTED] subscription not required */');
      log.ok(`Bypassed stripeSubscriptionId check in ${relativePath}`);
      modified = true;
    }

    // =========================================================================
    // Strategy 2: UNLIMITED SEATS for self-hosted (simulate Pro license)
    // =========================================================================

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
    // Strategy 3: ENABLE ALL PRO FEATURES
    // =========================================================================

    // Pattern: isPro in conditional contexts -> true
    if (!newContent.includes('[SELF-HOSTED]')) {
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
      newContent = newContent.replace(upgradeComponentRegex, '{null}');
      log.ok(`Removed upgrade component in ${relativePath}`);
      modified = true;
    }

    // Pattern: <UpgradeButton>...</UpgradeButton>
    const upgradeComponentBlockRegex = /<(UpgradeButton|UpgradePrompt|PricingCard|SubscriptionBanner|PaywallModal)[^>]*>[\s\S]*?<\/\1>/g;
    if (upgradeComponentBlockRegex.test(newContent)) {
      newContent = newContent.replace(upgradeComponentBlockRegex, '{null}');
      log.ok(`Removed upgrade component block in ${relativePath}`);
      modified = true;
    }

    // Pattern: BillingCard.tsx - make it return null instead of billing UI
    if (relativePath.includes('BillingCard.tsx')) {
      const billingCardReturnRegex = /(export\s+const\s+BillingCard\s*=\s*\([^)]*\)\s*(?::\s*\w+)?\s*=>\s*\{)/;
      if (billingCardReturnRegex.test(newContent)) {
        newContent = newContent.replace(
          billingCardReturnRegex,
          '$1\n  // [SELF-HOSTED] Billing UI disabled\n  return null;\n'
        );
        log.ok(`Disabled BillingCard component in ${relativePath}`);
        modified = true;
      }
    }

    // =========================================================================
    // Strategy 5: Neutralize Stripe API route handlers
    // =========================================================================

    if (relativePath.includes('stripe') || relativePath.includes('webhook') || relativePath.includes('billing')) {
      const handlerBodyRegex = /(export\s+(?:default\s+)?(?:async\s+)?function\s+(?:POST|GET|handler)\s*\([^)]*\)\s*\{)/;
      if (handlerBodyRegex.test(newContent) && hasStripe) {
        newContent = newContent.replace(
          handlerBodyRegex,
          `$1\n  // [SELF-HOSTED] Stripe disabled for self-hosted deployment\n  return new Response(JSON.stringify({ error: "Payments disabled in self-hosted mode" }), { status: 501, headers: { "Content-Type": "application/json" } });\n`
        );
        log.ok(`Disabled Stripe API route in ${relativePath}`);
        modified = true;
      }
    }

    // =========================================================================
    // Strategy 6: Handle getProStatus / checkSubscription type functions
    // =========================================================================

    const proStatusFuncRegex = /((?:async\s+)?function\s+(?:getProStatus|checkSubscription|getSubscriptionStatus|isUserPro)\s*\([^)]*\)\s*\{)/;
    if (proStatusFuncRegex.test(newContent)) {
      newContent = newContent.replace(
        proStatusFuncRegex,
        `$1\n  // [SELF-HOSTED] Always return pro status\n  return { isPro: true, status: "active", plan: "pro" };\n`
      );
      log.ok(`Made ${relativePath} always return pro status`);
      modified = true;
    }

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
    // Strategy 7: Neutralize manage-billing action
    // =========================================================================
    if (relativePath.includes('manage-billing')) {
      const manageBillingRegex = /(export\s+async\s+function\s+manageBilling\s*\([^)]*\)\s*\{)/;
      if (manageBillingRegex.test(newContent)) {
        newContent = newContent.replace(
          manageBillingRegex,
          `$1\n  // [SELF-HOSTED] Billing management disabled\n  throw new Error("Billing is disabled in self-hosted mode");\n`
        );
        log.ok(`Disabled manageBilling in ${relativePath}`);
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
    } else if (hasStripe || hasPayment) {
      skippedFiles++;
      log.warn(`Contains payment references but no actionable patterns: ${relativePath}`);
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
  console.log(`  • Stripe utility replaced with mock (returns null)`);
  console.log(`  • STRIPE_AVAILABLE = false`);
  console.log(`  • All subscription checks return "active"`);
  console.log(`  • isPro / isSubscribed = true`);
  console.log(`  • plan = "pro" (not "free")`);
  console.log(`  • Seats: UNLIMITED (Number.MAX_SAFE_INTEGER)`);
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
