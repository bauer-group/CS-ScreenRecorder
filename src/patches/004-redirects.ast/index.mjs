#!/usr/bin/env node
/**
 * Redirects Patch
 * Adds custom URL redirects via Next.js middleware
 *
 * Uses ts-morph for robust AST-based code modifications.
 *
 * Redirects added:
 * - /terms    -> https://go.bauer-group.com/screenrecorder-terms
 * - /privacy  -> https://go.bauer-group.com/screenrecorder-privacy
 * - /download -> CAP_CLIENT_DOWNLOAD_URL env var (if set)
 */

import { Project, SyntaxKind } from 'ts-morph';
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
console.log(`${colors.blue}  Redirects Patch (middleware)${colors.reset}`);
console.log(`${colors.blue}  AST-based patching with ts-morph${colors.reset}`);
console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log('');

// Initialize ts-morph project
const project = new Project({
  skipAddingFilesFromTsConfig: true,
  compilerOptions: {
    allowJs: true,
  }
});

// Redirect configuration
const REDIRECT_PATHS = ['/terms', '/privacy', '/download'];
const REDIRECT_HANDLER_MARKER = 'Custom redirects';

// The redirect handler code to insert
const REDIRECT_HANDLER_CODE = `
  // === Custom redirects (added by 004-redirects.ast) ===
  const customRedirects: { [key: string]: string | undefined } = {
    "/terms": "https://go.bauer-group.com/screenrecorder-terms",
    "/privacy": "https://go.bauer-group.com/screenrecorder-privacy",
    "/download": process.env.CAP_CLIENT_DOWNLOAD_URL,
  };

  const redirectUrl = customRedirects[request.nextUrl.pathname];
  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }
  // === End custom redirects ===
`;

/**
 * Main patch function
 */
function patchMiddleware() {
  const filePath = path.join(APP_DIR, 'apps/web/middleware.ts');

  if (!fs.existsSync(filePath)) {
    log.warn('middleware.ts not found - skipping redirects patch');
    return true; // Non-critical
  }

  log.info('Found middleware.ts');

  const sourceFile = project.addSourceFileAtPath(filePath);
  let text = sourceFile.getText();
  let modified = false;

  // Check if already patched
  if (text.includes(REDIRECT_HANDLER_MARKER)) {
    log.warn('Redirects already configured');
    return true;
  }

  // ==========================================================================
  // Step 1: Add redirect paths to the matcher config
  // ==========================================================================
  log.info('[1/2] Adding redirect paths to matcher...');

  // Find the config export with matcher array
  // Pattern: export const config = { matcher: [...] }
  const configVar = sourceFile.getVariableDeclaration('config');

  if (configVar) {
    const initializer = configVar.getInitializer();

    if (initializer && initializer.getKind() === SyntaxKind.ObjectLiteralExpression) {
      const configObj = initializer.asKind(SyntaxKind.ObjectLiteralExpression);
      const matcherProp = configObj?.getProperty('matcher');

      if (matcherProp) {
        const matcherInit = matcherProp.getFirstChildByKind(SyntaxKind.ArrayLiteralExpression);

        if (matcherInit) {
          const existingElements = matcherInit.getElements().map(e => e.getText());

          // Add our paths if not already present
          for (const redirectPath of REDIRECT_PATHS) {
            const pathStr = `"${redirectPath}"`;
            if (!existingElements.some(e => e.includes(redirectPath))) {
              matcherInit.insertElement(0, pathStr);
              log.success(`Added ${redirectPath} to matcher`);
              modified = true;
            } else {
              log.warn(`${redirectPath} already in matcher`);
            }
          }
        }
      }
    }
  }

  if (!modified) {
    // Fallback: text-based insertion for matcher
    log.warn('Could not find matcher via AST, trying text-based approach...');

    const matcherPattern = /matcher:\s*\[/;
    if (matcherPattern.test(text)) {
      const pathsToAdd = REDIRECT_PATHS.map(p => `"${p}"`).join(',\n    ');
      text = text.replace(matcherPattern, `matcher: [\n    ${pathsToAdd},`);
      modified = true;
      log.success('Added redirect paths to matcher (fallback)');
    }
  }

  // ==========================================================================
  // Step 2: Add redirect handler at the start of the middleware function
  // ==========================================================================
  log.info('[2/2] Adding redirect handler to middleware function...');

  // Refresh source file if we modified via text
  if (modified) {
    sourceFile.replaceWithText(text);
  }

  // Find the middleware function
  // Pattern: export function middleware(request) { ... }
  // or: export async function middleware(request) { ... }
  const middlewareFunc = sourceFile.getFunction('middleware');

  if (middlewareFunc) {
    const body = middlewareFunc.getBody();

    if (body && body.getKind() === SyntaxKind.Block) {
      // Insert our redirect handler at the beginning of the function body
      const statements = body.getStatements();

      if (statements.length > 0) {
        // Insert before the first statement
        statements[0].replaceWithText(REDIRECT_HANDLER_CODE.trim() + '\n\n  ' + statements[0].getText());
        log.success('Added redirect handler to middleware function');
        modified = true;
      }
    }
  } else {
    // Fallback: text-based insertion
    log.warn('Could not find middleware function via AST, trying text-based approach...');

    text = sourceFile.getText();
    const funcPattern = /export\s+(async\s+)?function\s+middleware\s*\([^)]*\)\s*\{/;
    const match = text.match(funcPattern);

    if (match) {
      const insertPoint = match.index + match[0].length;
      text = text.slice(0, insertPoint) + REDIRECT_HANDLER_CODE + text.slice(insertPoint);
      sourceFile.replaceWithText(text);
      log.success('Added redirect handler (fallback)');
      modified = true;
    } else {
      log.error('Could not find middleware function');
    }
  }

  // Save changes
  if (modified) {
    sourceFile.saveSync();
    log.success('middleware.ts patched');
  }

  return modified;
}

/**
 * Verify the patch was applied correctly
 */
function verifyPatch() {
  log.info('Verifying configuration...');

  const filePath = path.join(APP_DIR, 'apps/web/middleware.ts');
  if (!fs.existsSync(filePath)) {
    return true; // File doesn't exist, nothing to verify
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let success = true;

  if (content.includes('screenrecorder-terms')) {
    log.success('/terms redirect configured');
  } else {
    log.error('/terms redirect missing');
    success = false;
  }

  if (content.includes('screenrecorder-privacy')) {
    log.success('/privacy redirect configured');
  } else {
    log.error('/privacy redirect missing');
    success = false;
  }

  if (content.includes('CAP_CLIENT_DOWNLOAD_URL')) {
    log.success('/download redirect configured');
  } else {
    log.error('/download redirect missing');
    success = false;
  }

  return success;
}

// =============================================================================
// Main execution
// =============================================================================
async function main() {
  try {
    const patched = patchMiddleware();
    const verified = verifyPatch();

    console.log('');
    console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.green}  Redirects patch complete!${colors.reset}`);
    console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log('');
    console.log('Configured redirects (via middleware):');
    console.log(`  ${colors.yellow}/terms${colors.reset}    → https://go.bauer-group.com/screenrecorder-terms`);
    console.log(`  ${colors.yellow}/privacy${colors.reset}  → https://go.bauer-group.com/screenrecorder-privacy`);
    console.log(`  ${colors.yellow}/download${colors.reset} → CAP_CLIENT_DOWNLOAD_URL environment variable`);
    console.log('');

    if (!verified) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`${colors.red}Patch failed:${colors.reset}`, error);
    process.exit(1);
  }
}

main();
