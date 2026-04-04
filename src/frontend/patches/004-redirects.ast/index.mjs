#!/usr/bin/env node
/**
 * Redirects Patch
 * Adds custom URL redirects via Next.js config (redirects/rewrites)
 *
 * Since Cap v0.4.72+, middleware.ts was removed upstream.
 * Redirects are now injected into next.config.mjs instead.
 *
 * Redirects added:
 * - /terms    -> https://go.bauer-group.com/screenrecorder-terms (permanent)
 * - /privacy  -> https://go.bauer-group.com/screenrecorder-privacy (permanent)
 * - /download -> CAP_CLIENT_DOWNLOAD_URL env var (conditional, non-permanent)
 */

import fs from 'fs';
import path from 'path';

const APP_DIR = process.env.APP_DIR || '/app';

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
console.log(`${c.blue}  Redirects Patch (next.config.mjs)${c.reset}`);
console.log(`${c.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

const PATCH_MARKER = '004-redirects.ast';

const CUSTOM_REDIRECTS = `\
			// === Custom redirects (added by ${PATCH_MARKER}) ===
			{
				source: "/terms",
				destination: "https://go.bauer-group.com/screenrecorder-terms",
				permanent: true,
			},
			{
				source: "/privacy",
				destination: "https://go.bauer-group.com/screenrecorder-privacy",
				permanent: true,
			},`;

const CUSTOM_DOWNLOAD_REWRITE = `\
			// === Custom download rewrite (added by ${PATCH_MARKER}) ===
			...(process.env.CAP_CLIENT_DOWNLOAD_URL
				? [{
						source: "/download",
						destination: process.env.CAP_CLIENT_DOWNLOAD_URL,
					}]
				: []),`;

function patchNextConfig() {
  const filePath = path.join(APP_DIR, 'apps/web/next.config.mjs');

  if (!fs.existsSync(filePath)) {
    log.err('next.config.mjs not found');
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes(PATCH_MARKER)) {
    log.warn('Redirects already configured - skipping');
    return true;
  }

  let modified = false;

  // ========================================================================
  // Step 1: Add /terms and /privacy to redirects()
  // ========================================================================
  log.info('[1/2] Adding /terms and /privacy redirects...');

  // Pattern: find "async redirects() {" and then the "return [" inside it
  // Insert our redirects right after "return ["
  const redirectsReturnPattern = /(async\s+redirects\s*\(\s*\)\s*\{[\s\S]*?return\s*\[)/;
  const redirectsMatch = content.match(redirectsReturnPattern);

  if (redirectsMatch) {
    content = content.replace(
      redirectsReturnPattern,
      `$1\n${CUSTOM_REDIRECTS}`
    );
    log.ok('Added /terms redirect');
    log.ok('Added /privacy redirect');
    modified = true;
  } else {
    log.err('Could not find redirects() function in next.config.mjs');
    return false;
  }

  // ========================================================================
  // Step 2: Add /download to rewrites()
  // ========================================================================
  log.info('[2/2] Adding /download rewrite (dynamic via env var)...');

  const rewritesReturnPattern = /(async\s+rewrites\s*\(\s*\)\s*\{[\s\S]*?return\s*\[)/;
  const rewritesMatch = content.match(rewritesReturnPattern);

  if (rewritesMatch) {
    content = content.replace(
      rewritesReturnPattern,
      `$1\n${CUSTOM_DOWNLOAD_REWRITE}`
    );
    log.ok('Added /download rewrite (conditional on CAP_CLIENT_DOWNLOAD_URL)');
    modified = true;
  } else {
    log.err('Could not find rewrites() function in next.config.mjs');
    return false;
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    log.ok('next.config.mjs patched');
  }

  return modified;
}

function verifyPatch() {
  log.info('Verifying configuration...');

  const filePath = path.join(APP_DIR, 'apps/web/next.config.mjs');
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let success = true;

  if (content.includes('screenrecorder-terms')) {
    log.ok('/terms redirect configured');
  } else {
    log.err('/terms redirect missing');
    success = false;
  }

  if (content.includes('screenrecorder-privacy')) {
    log.ok('/privacy redirect configured');
  } else {
    log.err('/privacy redirect missing');
    success = false;
  }

  if (content.includes('CAP_CLIENT_DOWNLOAD_URL')) {
    log.ok('/download rewrite configured');
  } else {
    log.err('/download rewrite missing');
    success = false;
  }

  return success;
}

async function main() {
  try {
    const patched = patchNextConfig();
    const verified = verifyPatch();

    console.log('');
    console.log(`${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
    console.log(`${c.green}  Redirects patch complete!${c.reset}`);
    console.log(`${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
    console.log('Configured redirects (via next.config.mjs):');
    console.log(`  ${c.yellow}/terms${c.reset}    → https://go.bauer-group.com/screenrecorder-terms`);
    console.log(`  ${c.yellow}/privacy${c.reset}  → https://go.bauer-group.com/screenrecorder-privacy`);
    console.log(`  ${c.yellow}/download${c.reset} → CAP_CLIENT_DOWNLOAD_URL environment variable`);
    console.log('');

    if (!patched || !verified) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`${c.red}Patch failed:${c.reset}`, error);
    process.exit(1);
  }
}

main();
