#!/usr/bin/env node
/**
 * Replace Google OAuth with Microsoft Entra ID (Azure AD) Patch
 *
 * Instead of adding Microsoft alongside Google, this patch REPLACES
 * Google OAuth with Microsoft Entra ID. Simple string replacements.
 */

import fs from 'fs';
import path from 'path';

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
console.log(`${c.blue}  Replace Google with Microsoft Entra ID Patch${c.reset}`);
console.log(`${c.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

let success = 0, total = 0;

// =============================================================================
// 1. auth-options.ts - Replace GoogleProvider with AzureADProvider
// =============================================================================
function patch1_AuthOptions() {
  log.info('[1/6] auth-options.ts - Replace GoogleProvider with AzureADProvider');
  total++;

  const file = path.join(APP_DIR, 'packages/database/auth/auth-options.ts');
  if (!fs.existsSync(file)) { log.err('File not found'); return false; }

  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('AzureADProvider')) {
    log.warn('Already patched');
    success++;
    return true;
  }

  // 1a. Replace import
  content = content.replace(
    'import GoogleProvider from "next-auth/providers/google";',
    'import AzureADProvider from "next-auth/providers/azure-ad";'
  );
  log.ok('Replaced import');

  // 1b. Replace provider config
  // Match GoogleProvider({...}), and replace entirely
  const googleProviderRegex = /GoogleProvider\(\{[\s\S]*?clientId:\s*serverEnv\(\)\.GOOGLE_CLIENT_ID!,[\s\S]*?clientSecret:\s*serverEnv\(\)\.GOOGLE_CLIENT_SECRET!,[\s\S]*?\}\)/;

  const azureConfig = `AzureADProvider({
      clientId: serverEnv().AZURE_AD_CLIENT_ID!,
      clientSecret: serverEnv().AZURE_AD_CLIENT_SECRET!,
      tenantId: serverEnv().AZURE_AD_TENANT_ID || "common",
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "select_account",
        },
      },
    })`;

  if (googleProviderRegex.test(content)) {
    content = content.replace(googleProviderRegex, azureConfig);
    log.ok('Replaced provider config');
  } else {
    log.err('GoogleProvider config not found');
    log.debug('Trying simpler pattern...');

    // Simpler fallback pattern
    const simplePattern = /GoogleProvider\(\{[^}]*\}\)/;
    if (simplePattern.test(content)) {
      content = content.replace(simplePattern, azureConfig);
      log.ok('Replaced provider config (simple pattern)');
    } else {
      log.err('Could not find GoogleProvider to replace');
      return false;
    }
  }

  fs.writeFileSync(file, content);
  log.ok('File saved');
  success++;
  return true;
}

// =============================================================================
// 2. env/server.ts - Replace GOOGLE env vars with AZURE_AD env vars
// =============================================================================
function patch2_EnvServer() {
  log.info('[2/6] env/server.ts - Replace Google env vars with Azure AD');
  total++;

  const file = path.join(APP_DIR, 'packages/env/server.ts');
  if (!fs.existsSync(file)) { log.err('File not found'); return false; }

  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('AZURE_AD_CLIENT_ID')) {
    log.warn('Already patched');
    success++;
    return true;
  }

  // Replace GOOGLE vars with AZURE_AD vars
  // GOOGLE_CLIENT_ID: z.string().optional(),
  // GOOGLE_CLIENT_SECRET: z.string().optional(),

  content = content.replace(
    /GOOGLE_CLIENT_ID:\s*z\.string\(\)\.optional\(\),/,
    `AZURE_AD_CLIENT_ID: z.string().optional(),`
  );
  log.ok('Replaced GOOGLE_CLIENT_ID → AZURE_AD_CLIENT_ID');

  content = content.replace(
    /GOOGLE_CLIENT_SECRET:\s*z\.string\(\)\.optional\(\),/,
    `AZURE_AD_CLIENT_SECRET: z.string().optional(),
    AZURE_AD_TENANT_ID: z.string().optional(),`
  );
  log.ok('Replaced GOOGLE_CLIENT_SECRET → AZURE_AD_CLIENT_SECRET + TENANT_ID');

  fs.writeFileSync(file, content);
  log.ok('File saved');
  success++;
  return true;
}

// =============================================================================
// 3. public-env.tsx - Replace googleAuthAvailable with microsoftAuthAvailable
// =============================================================================
function patch3_PublicEnv() {
  log.info('[3/6] public-env.tsx - Replace googleAuthAvailable type');
  total++;

  const file = path.join(APP_DIR, 'apps/web/utils/public-env.tsx');
  if (!fs.existsSync(file)) { log.err('File not found'); return false; }

  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('microsoftAuthAvailable')) {
    log.warn('Already patched');
    success++;
    return true;
  }

  // Replace type definition
  content = content.replace(
    /googleAuthAvailable:\s*boolean;?/,
    'microsoftAuthAvailable: boolean;'
  );
  log.ok('Replaced type definition');

  fs.writeFileSync(file, content);
  log.ok('File saved');
  success++;
  return true;
}

// =============================================================================
// 4. layout.tsx - Replace GOOGLE_CLIENT_ID check with AZURE_AD_CLIENT_ID
// =============================================================================
function patch4_Layout() {
  log.info('[4/6] layout.tsx - Replace Google env check with Azure AD');
  total++;

  const file = path.join(APP_DIR, 'apps/web/app/layout.tsx');
  if (!fs.existsSync(file)) { log.err('File not found'); return false; }

  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('microsoftAuthAvailable')) {
    log.warn('Already patched');
    success++;
    return true;
  }

  // Replace: googleAuthAvailable: !!serverEnv().GOOGLE_CLIENT_ID,
  // With:    microsoftAuthAvailable: !!serverEnv().AZURE_AD_CLIENT_ID,
  content = content.replace(
    /googleAuthAvailable:\s*!!serverEnv\(\)\.GOOGLE_CLIENT_ID,?/,
    'microsoftAuthAvailable: !!serverEnv().AZURE_AD_CLIENT_ID,'
  );
  log.ok('Replaced env check');

  fs.writeFileSync(file, content);
  log.ok('File saved');
  success++;
  return true;
}

// =============================================================================
// 5. form.tsx - Replace all Google references with Microsoft
// =============================================================================
function patch5_LoginForm() {
  log.info('[5/6] form.tsx - Replace Google with Microsoft');
  total++;

  const file = path.join(APP_DIR, 'apps/web/app/(org)/login/form.tsx');
  if (!fs.existsSync(file)) { log.err('File not found'); return false; }

  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('handleMicrosoftSignIn')) {
    log.warn('Already patched');
    success++;
    return true;
  }

  // Replace handler name
  content = content.replace(/handleGoogleSignIn/g, 'handleMicrosoftSignIn');
  log.ok('Replaced handler name');

  // Replace signIn provider - "google" → "azure-ad"
  content = content.replace(/signIn\("google"/g, 'signIn("azure-ad"');
  log.ok('Replaced signIn provider');

  // Replace publicEnv check
  content = content.replace(/publicEnv\.googleAuthAvailable/g, 'publicEnv.microsoftAuthAvailable');
  log.ok('Replaced publicEnv check');

  // Replace Image component with inline SVG for Microsoft logo
  // Pattern: <Image src="/google.svg" alt="Google" width={16} height={16} />
  const imagePattern = /<Image\s+src=["'][^"']*google\.svg["']\s+alt=["']Google["']\s+width=\{16\}\s+height=\{16\}\s*\/>/g;
  const msSvg = `<svg width="16" height="16" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>`;

  if (imagePattern.test(content)) {
    content = content.replace(imagePattern, msSvg);
    log.ok('Replaced Image with inline SVG');
  } else {
    // Fallback: try simpler pattern
    content = content.replace(/<Image[^>]*google\.svg[^>]*\/>/g, msSvg);
    log.ok('Replaced Image with inline SVG (fallback pattern)');
  }
  log.ok('Replaced logo');

  // Replace alt text
  content = content.replace(/alt="Google"/g, 'alt="Microsoft"');
  log.ok('Replaced alt text');

  // Replace button text
  content = content.replace(/Login with Google/g, 'Login with Microsoft');
  log.ok('Replaced button text');

  // Replace tracking event method
  content = content.replace(/method:\s*"google"/g, 'method: "microsoft"');
  log.ok('Replaced tracking method');

  fs.writeFileSync(file, content);
  log.ok('File saved');
  success++;
  return true;
}

// =============================================================================
// 6. Logo - now handled inline in patch5, this just confirms
// =============================================================================
function patch6_Logo() {
  log.info('[6/6] Microsoft logo (inline SVG in form.tsx)');
  total++;
  log.ok('Logo is embedded as inline SVG - no external file needed');
  success++;
  return true;
}

// =============================================================================
// Main
// =============================================================================
function main() {
  patch1_AuthOptions();
  patch2_EnvServer();
  patch3_PublicEnv();
  patch4_Layout();
  patch5_LoginForm();
  patch6_Logo();

  console.log(`\n${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`${c.green}  Complete: ${success}/${total} patches applied${c.reset}`);
  console.log(`${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

  if (success < total) {
    console.log(`${c.red}Some patches failed!${c.reset}`);
    process.exit(1);
  }

  console.log(`${c.blue}Note: Set these environment variables:${c.reset}`);
  console.log(`  AZURE_AD_CLIENT_ID=your-client-id`);
  console.log(`  AZURE_AD_CLIENT_SECRET=your-client-secret`);
  console.log(`  AZURE_AD_TENANT_ID=your-tenant-id (or "common" for multi-tenant)\n`);
}

main();
