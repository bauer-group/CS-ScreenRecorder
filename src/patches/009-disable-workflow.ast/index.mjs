#!/usr/bin/env node
/**
 * Disable Workflow & Cloud Services Patch
 *
 * Cloud services that require external configuration are disabled for
 * self-hosted deployments. This patch:
 * - Removes the workflow wrapper from next.config.mjs
 * - Disables workflow-related imports (transcription feature)
 * - Fixes Tinybird analytics to not crash when TINYBIRD_HOST is missing
 * - Adds early returns in workflow files to prevent execution
 *
 * Compatible with Cap v0.4.x
 */

import fs from 'fs';
import path from 'path';

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
  err: (msg) => console.log(`${c.red}  ✗ ${msg}${c.reset}`)
};

console.log(`${c.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
console.log(`${c.blue}  Disable Workflow & Cloud Services (Self-Hosted)${c.reset}`);
console.log(`${c.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);

let modifiedFiles = 0;

async function main() {
  // ==========================================================================
  // Patch 1: Remove workflow from next.config.mjs
  // ==========================================================================
  const nextConfigPath = path.join(APP_DIR, 'apps/web/next.config.mjs');

  if (fs.existsSync(nextConfigPath)) {
    let content = fs.readFileSync(nextConfigPath, 'utf8');
    let modified = false;

    // Check if workflow is used
    if (content.includes('workflow/next') || content.includes('withWorkflow')) {
      // Remove workflow import
      content = content.replace(/import\s+workflowNext\s+from\s+["']workflow\/next["'];\s*\n?/g, '');

      // Remove withWorkflow destructuring
      content = content.replace(/const\s*\{\s*withWorkflow\s*\}\s*=\s*workflowNext;\s*\n?/g, '');

      // Replace withWorkflow(nextConfig) with just nextConfig
      content = content.replace(/export\s+default\s+withWorkflow\s*\(\s*nextConfig\s*\)\s*;?/, 'export default nextConfig;');

      fs.writeFileSync(nextConfigPath, content);
      log.ok('Removed workflow wrapper from next.config.mjs');
      modifiedFiles++;
      modified = true;
    }

    if (!modified) {
      log.warn('next.config.mjs does not use workflow - skipping');
    }
  } else {
    log.warn('next.config.mjs not found');
  }

  // ==========================================================================
  // Patch 2: Disable workflow imports in transcribe.ts
  // ==========================================================================
  const transcribePath = path.join(APP_DIR, 'apps/web/lib/transcribe.ts');

  if (fs.existsSync(transcribePath)) {
    let content = fs.readFileSync(transcribePath, 'utf8');

    if (content.includes('workflow')) {
      // Comment out workflow-related code and make the function a no-op
      const newContent = `// [SELF-HOSTED] Workflow/Transcription disabled - requires external service
// Original file used the 'workflow' package which requires cloud configuration

export async function transcribeVideo(videoId: string): Promise<void> {
  console.log('[SELF-HOSTED] Transcription disabled - workflow service not available');
  // Transcription is a Pro cloud feature, not available in self-hosted mode
  return;
}
`;
      fs.writeFileSync(transcribePath, newContent);
      log.ok('Disabled workflow in transcribe.ts');
      modifiedFiles++;
    }
  }

  // ==========================================================================
  // Patch 3: Fix Tinybird to not crash when TINYBIRD_HOST is missing
  // ==========================================================================
  const tinybirdPath = path.join(APP_DIR, 'packages/web-backend/src/Tinybird/index.ts');

  if (fs.existsSync(tinybirdPath)) {
    let content = fs.readFileSync(tinybirdPath, 'utf8');

    // Replace the fatal die() call with a graceful fallback
    if (content.includes('Effect.die(new Error("TINYBIRD_HOST must be set"))')) {
      content = content.replace(
        /if\s*\(\s*!host\s*\)\s*\{\s*yield\*\s*Effect\.die\s*\(\s*new\s*Error\s*\(\s*["']TINYBIRD_HOST must be set["']\s*\)\s*\)\s*;\s*\}/,
        `if (!host) {
      // [SELF-HOSTED] Tinybird analytics disabled - no TINYBIRD_HOST configured
      yield* Effect.logWarning("Tinybird disabled: TINYBIRD_HOST is not set");
    }`
      );
      fs.writeFileSync(tinybirdPath, content);
      log.ok('Fixed Tinybird to not crash when TINYBIRD_HOST is missing');
      modifiedFiles++;
    } else {
      log.warn('Tinybird already patched or pattern changed');
    }
  }

  // ==========================================================================
  // Patch 4: Handle workflow directory if it exists
  // ==========================================================================
  const workflowsDir = path.join(APP_DIR, 'apps/web/workflows');

  if (fs.existsSync(workflowsDir)) {
    const workflowFiles = fs.readdirSync(workflowsDir);

    for (const file of workflowFiles) {
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        const filePath = path.join(workflowsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Add early return to disable workflow
        if (content.includes('export') && !content.includes('[SELF-HOSTED]')) {
          const newContent = `// [SELF-HOSTED] Workflow disabled
${content.replace(/^(export\s+(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{)/gm,
  '$1\n  // Workflows disabled in self-hosted mode\n  return null as any;\n')}`;

          fs.writeFileSync(filePath, newContent);
          log.ok(`Disabled workflow: ${file}`);
          modifiedFiles++;
        }
      }
    }
  }

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log(`\n${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`${c.green}  Workflow & Cloud Services Disabled${c.reset}`);
  console.log(`${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`);
  console.log(`  Modified: ${c.green}${modifiedFiles}${c.reset} file(s)`);
  console.log(`\n${c.blue}DISABLED SERVICES:${c.reset}`);
  console.log(`  • Workflow (transcription) - requires cloud infrastructure`);
  console.log(`  • Tinybird analytics - optional, no TINYBIRD_HOST set`);
  console.log(`${c.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}\n`);
}

main().catch(err => {
  log.err(`Patch failed: ${err.message}`);
  console.error(err);
  process.exit(1);
});
