#!/usr/bin/env node
/**
 * Microsoft Entra ID (Azure AD) Authentication Patch
 *
 * Adds Microsoft login EXACTLY like Google login is implemented.
 * Reference: Google implementation in Cap v0.3.83
 */

import { Project } from 'ts-morph';
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
console.log(`${c.blue}  Microsoft Entra ID Authentication Patch${c.reset}`);
console.log(`${c.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

let success = 0, total = 0;

// =============================================================================
// 1. auth-options.ts - Add AzureADProvider (like GoogleProvider)
// =============================================================================
function patch1_AuthOptions() {
  log.info('[1/6] auth-options.ts - Add AzureADProvider');
  total++;

  const file = path.join(APP_DIR, 'packages/database/auth/auth-options.ts');
  if (!fs.existsSync(file)) { log.err('File not found'); return false; }

  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('AzureADProvider')) {
    log.warn('Already patched');
    success++;
    return true;
  }

  // 1a. Add import after GoogleProvider import
  const googleImport = 'import GoogleProvider from "next-auth/providers/google";';
  if (content.includes(googleImport)) {
    content = content.replace(
      googleImport,
      googleImport + '\nimport AzureADProvider from "next-auth/providers/azure-ad";'
    );
    log.ok('Added import');
  } else {
    log.err('GoogleProvider import not found');
    log.debug('Looking for: ' + googleImport);
    return false;
  }

  // 1b. Add provider config after GoogleProvider config
  // Pattern: GoogleProvider({...}),
  const googleProviderRegex = /GoogleProvider\(\{[\s\S]*?\}\s*\),/;
  const match = content.match(googleProviderRegex);

  if (match) {
    const azureConfig = `
    AzureADProvider({
      clientId: serverEnv().AZURE_AD_CLIENT_ID!,
      clientSecret: serverEnv().AZURE_AD_CLIENT_SECRET!,
      tenantId: serverEnv().AZURE_AD_TENANT_ID || "common",
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "select_account",
        },
      },
    }),`;
    content = content.replace(match[0], match[0] + azureConfig);
    log.ok('Added provider config');
  } else {
    log.err('GoogleProvider config not found');
    return false;
  }

  fs.writeFileSync(file, content);
  log.ok('File saved');
  success++;
  return true;
}

// =============================================================================
// 2. env/server.ts - Add AZURE_AD env vars (like GOOGLE vars)
// =============================================================================
function patch2_EnvServer() {
  log.info('[2/6] env/server.ts - Add Azure AD env vars');
  total++;

  const file = path.join(APP_DIR, 'packages/env/server.ts');
  if (!fs.existsSync(file)) { log.err('File not found'); return false; }

  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('AZURE_AD_CLIENT_ID')) {
    log.warn('Already patched');
    success++;
    return true;
  }

  // Add after GOOGLE_CLIENT_SECRET
  const pattern = /(GOOGLE_CLIENT_SECRET:\s*z\.string\(\)\.optional\(\),)/;
  const match = content.match(pattern);

  if (match) {
    const azureVars = `${match[0]}
    // Microsoft Entra ID (Azure AD)
    AZURE_AD_CLIENT_ID: z.string().optional(),
    AZURE_AD_CLIENT_SECRET: z.string().optional(),
    AZURE_AD_TENANT_ID: z.string().optional(),`;
    content = content.replace(match[0], azureVars);
    log.ok('Added env vars');
  } else {
    log.err('GOOGLE_CLIENT_SECRET not found');
    log.debug('Content preview: ' + content.substring(0, 300));
    return false;
  }

  fs.writeFileSync(file, content);
  log.ok('File saved');
  success++;
  return true;
}

// =============================================================================
// 3. public-env.tsx - Add microsoftAuthAvailable type (like googleAuthAvailable)
// =============================================================================
function patch3_PublicEnv() {
  log.info('[3/6] public-env.tsx - Add microsoftAuthAvailable type');
  total++;

  const file = path.join(APP_DIR, 'apps/web/utils/public-env.tsx');
  if (!fs.existsSync(file)) { log.err('File not found'); return false; }

  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('microsoftAuthAvailable')) {
    log.warn('Already patched');
    success++;
    return true;
  }

  // Find googleAuthAvailable in the type and add microsoftAuthAvailable
  // Pattern: googleAuthAvailable: boolean;
  const pattern = /(googleAuthAvailable:\s*boolean;?)/;
  const match = content.match(pattern);

  if (match) {
    log.debug('Found: ' + match[0]);
    content = content.replace(
      match[0],
      match[0] + '\n\tmicrosoftAuthAvailable: boolean;'
    );
    log.ok('Added type definition');
  } else {
    log.err('googleAuthAvailable type not found');
    log.debug('Content: ' + content);
    return false;
  }

  fs.writeFileSync(file, content);
  log.ok('File saved');
  success++;
  return true;
}

// =============================================================================
// 4. layout.tsx - Add microsoftAuthAvailable value (like googleAuthAvailable)
// =============================================================================
function patch4_Layout() {
  log.info('[4/6] layout.tsx - Add microsoftAuthAvailable value');
  total++;

  const file = path.join(APP_DIR, 'apps/web/app/layout.tsx');
  if (!fs.existsSync(file)) { log.err('File not found'); return false; }

  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('microsoftAuthAvailable')) {
    log.warn('Already patched');
    success++;
    return true;
  }

  // Find googleAuthAvailable: !!serverEnv().GOOGLE_CLIENT_ID and add microsoft after it
  const pattern = /(googleAuthAvailable:\s*!!serverEnv\(\)\.GOOGLE_CLIENT_ID,?)/;
  const match = content.match(pattern);

  if (match) {
    log.debug('Found: ' + match[0]);
    let replacement = match[0];
    if (!replacement.endsWith(',')) replacement += ',';
    replacement += '\n\t\t\t\tmicrosoftAuthAvailable: !!serverEnv().AZURE_AD_CLIENT_ID,';
    content = content.replace(match[0], replacement);
    log.ok('Added value');
  } else {
    log.err('googleAuthAvailable value not found');
    // Try to find what's there
    if (content.includes('googleAuthAvailable')) {
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('googleAuthAvailable')) {
          log.debug(`Line ${i+1}: ${lines[i]}`);
        }
      }
    }
    return false;
  }

  fs.writeFileSync(file, content);
  log.ok('File saved');
  success++;
  return true;
}

// =============================================================================
// 5. form.tsx - Add handler and button (like Google)
// =============================================================================
function patch5_LoginForm() {
  log.info('[5/6] form.tsx - Add Microsoft handler and button');
  total++;

  const file = path.join(APP_DIR, 'apps/web/app/(org)/login/form.tsx');
  if (!fs.existsSync(file)) { log.err('File not found'); return false; }

  let content = fs.readFileSync(file, 'utf8');

  if (content.includes('handleMicrosoftSignIn')) {
    log.warn('Already patched');
    success++;
    return true;
  }

  // 5a. Add handler after handleGoogleSignIn
  // Pattern: const handleGoogleSignIn = () => {...};
  const handlerPattern = /(const\s+handleGoogleSignIn\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\};)/;
  const handlerMatch = content.match(handlerPattern);

  if (handlerMatch) {
    log.debug('Found Google handler');
    const microsoftHandler = `

\tconst handleMicrosoftSignIn = () => {
\t\ttrackEvent("auth_started", { method: "microsoft", is_signup: true });
\t\tsignIn("azure-ad", {
\t\t\t...(next && next.length > 0 ? { callbackUrl: next } : {}),
\t\t});
\t};`;
    content = content.replace(handlerMatch[0], handlerMatch[0] + microsoftHandler);
    log.ok('Added handler');
  } else {
    log.err('handleGoogleSignIn not found');
    return false;
  }

  // 5b. Add button after Google button
  // Find: {publicEnv.googleAuthAvailable && !oauthError && (
  //         <MotionButton ... >Login with Google</MotionButton>
  //       )}

  // Strategy: Find "Login with Google" and then find the closing )}
  const lines = content.split('\n');
  let insertLine = -1;
  let indent = '\t\t\t\t';

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Login with Google')) {
      log.debug(`Found "Login with Google" at line ${i+1}`);
      // Find closing )} after </MotionButton>
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].includes('</MotionButton>')) {
          // Find )} on next lines
          for (let k = j; k < Math.min(j + 5, lines.length); k++) {
            if (lines[k].trim() === ')}') {
              insertLine = k;
              // Get indentation from googleAuthAvailable line
              for (let m = i; m >= Math.max(0, i - 10); m--) {
                if (lines[m].includes('googleAuthAvailable')) {
                  const indentMatch = lines[m].match(/^(\s*)/);
                  if (indentMatch) indent = indentMatch[1];
                  break;
                }
              }
              break;
            }
          }
          break;
        }
      }
      break;
    }
  }

  if (insertLine > 0) {
    const microsoftButton =
`${indent}{publicEnv.microsoftAuthAvailable && !oauthError && (
${indent}\t<MotionButton
${indent}\t\tvariant="gray"
${indent}\t\ttype="button"
${indent}\t\tclassName="flex gap-2 justify-center items-center w-full text-sm"
${indent}\t\tonClick={handleMicrosoftSignIn}
${indent}\t\tdisabled={loading || emailSent}
${indent}\t>
${indent}\t\t<Image src="/microsoft.svg" alt="Microsoft" width={16} height={16} />
${indent}\t\tLogin with Microsoft
${indent}\t</MotionButton>
${indent})}`;

    lines.splice(insertLine + 1, 0, microsoftButton);
    content = lines.join('\n');
    log.ok('Added button');
  } else {
    log.err('Could not find Google button block');
    return false;
  }

  fs.writeFileSync(file, content);
  log.ok('File saved');
  success++;
  return true;
}

// =============================================================================
// 6. Add Microsoft logo SVG
// =============================================================================
function patch6_Logo() {
  log.info('[6/6] Add Microsoft logo');
  total++;

  const dir = path.join(APP_DIR, 'apps/web/public');
  const file = path.join(dir, 'microsoft.svg');

  if (!fs.existsSync(dir)) { log.err('public dir not found'); return false; }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21">
  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
</svg>`;

  fs.writeFileSync(file, svg);
  log.ok('Logo saved');
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
}

main();
