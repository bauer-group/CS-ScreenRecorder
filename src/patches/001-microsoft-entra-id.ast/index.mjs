#!/usr/bin/env node
/**
 * Microsoft Entra ID (Azure AD) Authentication Patch
 *
 * Uses ts-morph for robust AST-based code modifications.
 * This approach is resilient to formatting changes across Cap versions.
 *
 * Compatible with Cap v0.3.x, v0.4.x and future versions.
 */

import { Project, SyntaxKind, VariableDeclarationKind } from 'ts-morph';
import fs from 'fs';
import path from 'path';

// Configuration
const APP_DIR = process.env.APP_DIR || '/app';

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}  ✓ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}  • ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}  ✗ ${msg}${colors.reset}`)
};

console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.blue}  Microsoft Entra ID (Azure AD) Authentication${colors.reset}`);
console.log(`${colors.blue}  AST-based patching with ts-morph${colors.reset}`);
console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log('');

// Initialize ts-morph project
const project = new Project({
  skipAddingFilesFromTsConfig: true,
  compilerOptions: {
    allowJs: true,
    jsx: 2 // React
  }
});

let patchCount = 0;
let successCount = 0;

// =============================================================================
// 1. Patch auth-options.ts - Add Azure AD Provider
// =============================================================================
function patchAuthOptions() {
  log.info('[1/6] Patching auth-options.ts...');
  patchCount++;

  const filePath = path.join(APP_DIR, 'packages/database/auth/auth-options.ts');

  if (!fs.existsSync(filePath)) {
    log.error('auth-options.ts not found');
    return false;
  }

  const sourceFile = project.addSourceFileAtPath(filePath);

  // Check if already patched
  if (sourceFile.getText().includes('AzureADProvider')) {
    log.warn('AzureADProvider already exists');
    successCount++;
    return true;
  }

  // Add import for AzureADProvider
  const googleImport = sourceFile.getImportDeclaration(
    (imp) => imp.getModuleSpecifierValue() === 'next-auth/providers/google'
  );

  if (googleImport) {
    sourceFile.addImportDeclaration({
      defaultImport: 'AzureADProvider',
      moduleSpecifier: 'next-auth/providers/azure-ad'
    });
    log.success('Added AzureADProvider import');
  }

  // Find the providers array and add AzureADProvider
  // Look for GoogleProvider call and insert after it
  const text = sourceFile.getText();
  const googleProviderMatch = text.match(/GoogleProvider\s*\(\s*\{[\s\S]*?\}\s*\)\s*,/);

  if (googleProviderMatch) {
    const azureProviderCode = `
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

    const newText = text.replace(
      googleProviderMatch[0],
      googleProviderMatch[0] + azureProviderCode
    );

    sourceFile.replaceWithText(newText);
    log.success('Added AzureADProvider configuration');
  }

  sourceFile.saveSync();
  log.success('auth-options.ts patched');
  successCount++;
  return true;
}

// =============================================================================
// 2. Patch packages/env/server.ts - Add environment variables
// =============================================================================
function patchEnvServer() {
  log.info('[2/6] Patching packages/env/server.ts...');
  patchCount++;

  const filePath = path.join(APP_DIR, 'packages/env/server.ts');

  if (!fs.existsSync(filePath)) {
    log.error('packages/env/server.ts not found');
    return false;
  }

  const sourceFile = project.addSourceFileAtPath(filePath);
  const text = sourceFile.getText();

  // Check if already patched
  if (text.includes('AZURE_AD_CLIENT_ID')) {
    log.warn('Azure AD env vars already exist');
    successCount++;
    return true;
  }

  // Find GOOGLE_CLIENT_SECRET and add Azure vars after it
  const googleSecretPattern = /GOOGLE_CLIENT_SECRET:\s*z\.string\(\)\.optional\(\),/;
  const match = text.match(googleSecretPattern);

  if (match) {
    const azureEnvVars = `GOOGLE_CLIENT_SECRET: z.string().optional(),
    // Microsoft Entra ID (Azure AD) Auth
    AZURE_AD_CLIENT_ID: z.string().optional(),
    AZURE_AD_CLIENT_SECRET: z.string().optional(),
    AZURE_AD_TENANT_ID: z.string().optional(),`;

    const newText = text.replace(match[0], azureEnvVars);
    sourceFile.replaceWithText(newText);
    log.success('Added Azure AD environment variables');
  } else {
    log.error('Could not find GOOGLE_CLIENT_SECRET pattern');
    return false;
  }

  sourceFile.saveSync();
  log.success('packages/env/server.ts patched');
  successCount++;
  return true;
}

// =============================================================================
// 3. Patch public-env.tsx - Add flag type
// =============================================================================
function patchPublicEnv() {
  log.info('[3/6] Patching public-env.tsx...');
  patchCount++;

  const filePath = path.join(APP_DIR, 'apps/web/utils/public-env.tsx');

  if (!fs.existsSync(filePath)) {
    log.warn('public-env.tsx not found (may be different in this version)');
    return true; // Non-critical
  }

  const sourceFile = project.addSourceFileAtPath(filePath);
  const text = sourceFile.getText();

  // Check if already patched
  if (text.includes('microsoftAuthAvailable')) {
    log.warn('microsoftAuthAvailable already exists');
    successCount++;
    return true;
  }

  // Find googleAuthAvailable in type definition and add microsoftAuthAvailable
  const typePattern = /(googleAuthAvailable:\s*boolean;)/;
  const match = text.match(typePattern);

  if (match) {
    const newText = text.replace(
      match[0],
      match[0] + '\n\tmicrosoftAuthAvailable: boolean;'
    );
    sourceFile.replaceWithText(newText);
    log.success('Added microsoftAuthAvailable type');
  } else {
    log.error('Could not find googleAuthAvailable pattern');
    return false;
  }

  sourceFile.saveSync();
  log.success('public-env.tsx patched');
  successCount++;
  return true;
}

// =============================================================================
// 4. Patch layout.tsx - Pass flag to provider
// =============================================================================
function patchLayout() {
  log.info('[4/6] Patching layout.tsx...');
  patchCount++;

  const filePath = path.join(APP_DIR, 'apps/web/app/layout.tsx');

  if (!fs.existsSync(filePath)) {
    log.warn('layout.tsx not found');
    return true; // Non-critical
  }

  const sourceFile = project.addSourceFileAtPath(filePath);
  const text = sourceFile.getText();

  // Check if already patched
  if (text.includes('microsoftAuthAvailable')) {
    log.warn('microsoftAuthAvailable already in layout');
    successCount++;
    return true;
  }

  // Find googleAuthAvailable assignment and add microsoftAuthAvailable
  const assignPattern = /(googleAuthAvailable:\s*!!serverEnv\(\)\.GOOGLE_CLIENT_ID,?)/;
  const match = text.match(assignPattern);

  if (match) {
    // Ensure trailing comma
    let replacement = match[0];
    if (!replacement.endsWith(',')) {
      replacement += ',';
    }
    replacement += '\n\t\t\tmicrosoftAuthAvailable: !!serverEnv().AZURE_AD_CLIENT_ID,';

    const newText = text.replace(match[0], replacement);
    sourceFile.replaceWithText(newText);
    log.success('Added microsoftAuthAvailable to layout context');
  } else {
    log.error('Could not find googleAuthAvailable pattern in layout');
    return false;
  }

  sourceFile.saveSync();
  log.success('layout.tsx patched');
  successCount++;
  return true;
}

// =============================================================================
// 5. Patch login form - Add Microsoft button (AST-based)
// =============================================================================
function patchLoginForm() {
  log.info('[5/6] Patching login form.tsx...');
  patchCount++;

  const filePath = path.join(APP_DIR, 'apps/web/app/(org)/login/form.tsx');

  if (!fs.existsSync(filePath)) {
    log.error('login form.tsx not found');
    return false;
  }

  const sourceFile = project.addSourceFileAtPath(filePath);
  let text = sourceFile.getText();
  let modified = false;

  // Check if already patched
  if (text.includes('handleMicrosoftSignIn')) {
    log.warn('Microsoft sign-in already exists');
    successCount++;
    return true;
  }

  // === Add handler function ===
  // Find handleGoogleSignIn and add handleMicrosoftSignIn after it
  // Using AST to find the arrow function

  const handleGoogleSignIn = sourceFile.getVariableDeclaration('handleGoogleSignIn');

  if (handleGoogleSignIn) {
    // Get the parent statement
    const statement = handleGoogleSignIn.getFirstAncestorByKind(SyntaxKind.VariableStatement);

    if (statement) {
      // Insert Microsoft handler after Google handler
      const microsoftHandler = `

  const handleMicrosoftSignIn = () => {
    trackEvent("auth_started", { method: "microsoft", is_signup: true });
    signIn("azure-ad", {
      ...(next && next.length > 0 ? { callbackUrl: next } : {}),
    });
  };`;

      statement.replaceWithText(statement.getText() + microsoftHandler);
      log.success('Added handleMicrosoftSignIn handler');
      modified = true;
    }
  } else {
    // Fallback: text-based insertion
    const handlerPattern = /const\s+handleGoogleSignIn\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\};/;
    const match = text.match(handlerPattern);

    if (match) {
      const microsoftHandler = `

  const handleMicrosoftSignIn = () => {
    trackEvent("auth_started", { method: "microsoft", is_signup: true });
    signIn("azure-ad", {
      ...(next && next.length > 0 ? { callbackUrl: next } : {}),
    });
  };`;

      text = text.replace(match[0], match[0] + microsoftHandler);
      modified = true;
      log.success('Added handleMicrosoftSignIn handler (fallback)');
    }
  }

  // Refresh text after potential AST modification
  if (modified && !text.includes('handleMicrosoftSignIn')) {
    text = sourceFile.getText();
  }

  // === Add Microsoft button ===
  if (!text.includes('microsoftAuthAvailable')) {
    // Find the Google button block by looking for "Login with Google"
    // and insert Microsoft button after the closing of that block

    const lines = text.split('\n');
    let insertIndex = -1;
    let indentation = '\t\t\t\t';

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Login with Google')) {
        // Find the closing )} for this block
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].includes('</MotionButton>')) {
            // Look for )} on next few lines
            for (let k = j; k < Math.min(j + 3, lines.length); k++) {
              if (lines[k].trim() === ')}') {
                insertIndex = k;
                // Get indentation from the googleAuthAvailable line
                for (let m = i; m >= 0; m--) {
                  if (lines[m].includes('googleAuthAvailable')) {
                    const indentMatch = lines[m].match(/^(\s*)/);
                    if (indentMatch) indentation = indentMatch[1];
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

    if (insertIndex > 0) {
      const microsoftButton = `
${indentation}{publicEnv.microsoftAuthAvailable && !oauthError && (
${indentation}\t<MotionButton
${indentation}\t\tvariant="gray"
${indentation}\t\ttype="button"
${indentation}\t\tclassName="flex gap-2 justify-center items-center w-full text-sm"
${indentation}\t\tonClick={handleMicrosoftSignIn}
${indentation}\t\tdisabled={loading || emailSent}
${indentation}\t>
${indentation}\t\t<Image src="/microsoft.svg" alt="Microsoft" width={16} height={16} />
${indentation}\t\tLogin with Microsoft
${indentation}\t</MotionButton>
${indentation})}`;

      lines.splice(insertIndex + 1, 0, microsoftButton);
      text = lines.join('\n');
      modified = true;
      log.success('Added Microsoft login button');
    } else {
      log.error('Could not find Google button block');
    }
  }

  if (modified) {
    sourceFile.replaceWithText(text);
    sourceFile.saveSync();
    log.success('login form.tsx patched');
    successCount++;
  }

  return modified;
}

// =============================================================================
// 6. Add Microsoft logo SVG
// =============================================================================
function addMicrosoftLogo() {
  log.info('[6/6] Adding Microsoft logo...');
  patchCount++;

  const publicDir = path.join(APP_DIR, 'apps/web/public');
  const logoPath = path.join(publicDir, 'microsoft.svg');

  if (!fs.existsSync(publicDir)) {
    log.warn('public directory not found');
    return true; // Non-critical
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21">
  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
</svg>`;

  fs.writeFileSync(logoPath, svg);
  log.success('Added microsoft.svg logo');
  successCount++;
  return true;
}

// =============================================================================
// Main execution
// =============================================================================
async function main() {
  try {
    patchAuthOptions();
    patchEnvServer();
    patchPublicEnv();
    patchLayout();
    patchLoginForm();
    addMicrosoftLogo();

    console.log('');
    console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.green}  Microsoft Entra ID patch complete!${colors.reset}`);
    console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log('');
    console.log(`  Patches: ${successCount}/${patchCount} successful`);
    console.log('');
    console.log('Required environment variables:');
    console.log(`  ${colors.yellow}AZURE_AD_CLIENT_ID${colors.reset}     - Application (client) ID`);
    console.log(`  ${colors.yellow}AZURE_AD_CLIENT_SECRET${colors.reset} - Client secret value`);
    console.log(`  ${colors.yellow}AZURE_AD_TENANT_ID${colors.reset}     - Directory (tenant) ID (optional)`);
    console.log('');
    console.log('Callback URL for Azure Portal:');
    console.log(`  ${colors.blue}https://your-domain.com/api/auth/callback/azure-ad${colors.reset}`);
    console.log('');

    if (successCount < patchCount) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`${colors.red}Patch failed:${colors.reset}`, error);
    process.exit(1);
  }
}

main();
