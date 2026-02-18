#!/usr/bin/env node
/**
 * SMTP Email Patch
 * Replaces Resend cloud service with standard SMTP support
 *
 * Uses ts-morph for robust AST-based code modifications.
 *
 * This patch modifies:
 * - packages/env/server.ts (add SMTP env vars)
 * - packages/database/auth/auth-options.ts (check SMTP_HOST in addition to RESEND_API_KEY)
 * - packages/database/emails/config.ts (add SMTP transport)
 * - packages/database/package.json (add nodemailer dependency)
 *
 * Supports:
 * - Standard SMTP with TLS/STARTTLS
 * - Custom from name and address
 * - Fallback to Resend if SMTP not configured
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
console.log(`${colors.blue}  SMTP Email Support Patch${colors.reset}`);
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

let patchCount = 0;
let successCount = 0;

// =============================================================================
// The complete SMTP-enabled email config
// =============================================================================
const SMTP_EMAIL_CONFIG = `import { serverEnv } from "@cap/env";
import { Resend } from "resend";
import { render } from "@react-email/render";
import nodemailer from "nodemailer";

// Initialize Resend client (fallback if no SMTP configured)
const resend = serverEnv().RESEND_API_KEY
  ? new Resend(serverEnv().RESEND_API_KEY)
  : null;

// Initialize SMTP transport
const smtpTransport = serverEnv().SMTP_HOST
  ? nodemailer.createTransport({
      host: serverEnv().SMTP_HOST,
      port: serverEnv().SMTP_PORT || 587,
      secure: serverEnv().SMTP_TLS === "true",
      auth: serverEnv().SMTP_USER
        ? {
            user: serverEnv().SMTP_USER,
            pass: serverEnv().SMTP_PASSWORD,
          }
        : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    })
  : null;

// Determine which transport to use
const useSmtp = !!smtpTransport;

export async function sendEmail({
  email,
  subject,
  react,
  marketing,
  scheduledAt,
  test,
}: {
  email: string;
  subject: string;
  react: React.ReactElement;
  marketing?: boolean;
  scheduledAt?: string;
  test?: boolean;
}) {
  // Determine sender address
  let from: string;
  const fromName = serverEnv().SMTP_FROM_NAME || "Cap";

  if (useSmtp && serverEnv().SMTP_FROM) {
    from = \`\${fromName} <\${serverEnv().SMTP_FROM}>\`;
  } else if (marketing) {
    from = "Richie from Cap <richie@send.cap.so>";
  } else if (serverEnv().NEXT_PUBLIC_IS_CAP) {
    from = "Cap Auth <no-reply@auth.cap.so>";
  } else if (serverEnv().RESEND_FROM_DOMAIN) {
    from = \`\${fromName} <auth@\${serverEnv().RESEND_FROM_DOMAIN}>\`;
  } else {
    from = \`\${fromName} <no-reply@example.com>\`;
  }

  // Test mode
  const to = test ? "delivered@resend.dev" : email;

  // Use SMTP if configured
  if (useSmtp && smtpTransport) {
    try {
      const html = await render(react);
      const result = await smtpTransport.sendMail({
        from,
        to,
        subject,
        html,
      });
      console.log(\`[SMTP] Email sent to \${to}: \${result.messageId}\`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error("[SMTP] Failed to send email:", error);
      throw error;
    }
  }

  // Fallback to Resend
  if (resend) {
    try {
      const result = await resend.emails.send({
        from,
        to,
        subject,
        react,
        scheduledAt,
      });
      return result;
    } catch (error) {
      console.error("[Resend] Failed to send email:", error);
      throw error;
    }
  }

  // No email transport configured - log to console (development mode)
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("[EMAIL] No transport configured - logging email:");
  console.log(\`  To: \${to}\`);
  console.log(\`  From: \${from}\`);
  console.log(\`  Subject: \${subject}\`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return { success: true, messageId: "console-log" };
}
`;

// =============================================================================
// 1. Patch packages/env/server.ts - Add SMTP environment variables
// =============================================================================
function patchEnvServer() {
  log.info('[1/4] Patching packages/env/server.ts...');
  patchCount++;

  const filePath = path.join(APP_DIR, 'packages/env/server.ts');

  if (!fs.existsSync(filePath)) {
    log.error('packages/env/server.ts not found');
    return false;
  }

  const sourceFile = project.addSourceFileAtPath(filePath);
  let text = sourceFile.getText();

  // Check if already patched
  if (text.includes('SMTP_HOST')) {
    log.warn('SMTP env vars already exist');
    successCount++;
    return true;
  }

  // Find RESEND_FROM_DOMAIN and add SMTP vars after it
  const resendPattern = /RESEND_FROM_DOMAIN:\s*z\.string\(\)\.optional\(\),/;
  const match = text.match(resendPattern);

  if (match) {
    const smtpEnvVars = `RESEND_FROM_DOMAIN: z.string().optional(),
    // SMTP Email Configuration
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional().default(587),
    SMTP_TLS: z.string().optional().default("false"),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    SMTP_FROM_NAME: z.string().optional(),`;

    text = text.replace(match[0], smtpEnvVars);
    sourceFile.replaceWithText(text);
    sourceFile.saveSync();
    log.success('Added SMTP environment variables');
    successCount++;
    return true;
  } else {
    log.error('Could not find RESEND_FROM_DOMAIN pattern');
    return false;
  }
}

// =============================================================================
// 2. Patch auth-options.ts - Check SMTP_HOST in addition to RESEND_API_KEY
// =============================================================================
function patchAuthOptions() {
  log.info('[2/4] Patching packages/database/auth/auth-options.ts...');
  patchCount++;

  const filePath = path.join(APP_DIR, 'packages/database/auth/auth-options.ts');

  if (!fs.existsSync(filePath)) {
    log.error('auth-options.ts not found');
    return false;
  }

  const sourceFile = project.addSourceFileAtPath(filePath);
  let text = sourceFile.getText();

  // Check if already patched
  if (text.includes('SMTP_HOST')) {
    log.warn('SMTP check already exists in auth-options.ts');
    successCount++;
    return true;
  }

  // Find the RESEND_API_KEY check and add SMTP_HOST
  // Pattern: if (!serverEnv().RESEND_API_KEY) or !serverEnv().RESEND_API_KEY
  let modified = false;

  // Try multiple patterns
  const patterns = [
    /if\s*\(\s*!serverEnv\(\)\.RESEND_API_KEY\s*\)/g,
    /!\s*serverEnv\(\)\.RESEND_API_KEY(?!\s*&&)/g,
  ];

  for (const pattern of patterns) {
    if (pattern.test(text)) {
      text = text.replace(pattern, (match) => {
        if (match.startsWith('if')) {
          return 'if (!serverEnv().RESEND_API_KEY && !serverEnv().SMTP_HOST)';
        } else {
          return '!serverEnv().RESEND_API_KEY && !serverEnv().SMTP_HOST';
        }
      });
      modified = true;
      break;
    }
  }

  if (modified) {
    sourceFile.replaceWithText(text);
    sourceFile.saveSync();
    log.success('Added SMTP_HOST check to auth-options.ts');
    successCount++;
    return true;
  } else {
    log.warn('Could not find RESEND_API_KEY pattern (may have changed)');
    return true; // Non-critical
  }
}

// =============================================================================
// 3. Replace emails/config.ts with SMTP support
// =============================================================================
function patchEmailConfig() {
  log.info('[3/4] Patching packages/database/emails/config.ts...');
  patchCount++;

  const filePath = path.join(APP_DIR, 'packages/database/emails/config.ts');

  if (!fs.existsSync(filePath)) {
    log.error('emails/config.ts not found');
    return false;
  }

  // Check if already patched
  const existingContent = fs.readFileSync(filePath, 'utf8');
  if (existingContent.includes('nodemailer')) {
    log.warn('SMTP/nodemailer already configured');
    successCount++;
    return true;
  }

  // Replace the entire file with SMTP-enabled version
  fs.writeFileSync(filePath, SMTP_EMAIL_CONFIG);
  log.success('Replaced email config with SMTP support');
  successCount++;
  return true;
}

// =============================================================================
// 4. Add nodemailer dependency to package.json
// =============================================================================
function patchPackageJson() {
  log.info('[4/4] Adding nodemailer dependency...');
  patchCount++;

  const filePath = path.join(APP_DIR, 'packages/database/package.json');

  if (!fs.existsSync(filePath)) {
    log.warn('package.json not found');
    return true; // Non-critical
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Check if already added
    if (pkg.dependencies && pkg.dependencies['nodemailer']) {
      log.warn('nodemailer already in dependencies');
      successCount++;
      return true;
    }

    // Add nodemailer and types
    pkg.dependencies = pkg.dependencies || {};
    pkg.dependencies['nodemailer'] = '^6.9.0';
    pkg.dependencies['@types/nodemailer'] = '^6.4.0';

    fs.writeFileSync(filePath, JSON.stringify(pkg, null, 2));
    log.success('Added nodemailer to package.json');
    successCount++;
    return true;
  } catch (error) {
    log.error(`Failed to update package.json: ${error.message}`);
    return false;
  }
}

// =============================================================================
// Main execution
// =============================================================================
async function main() {
  try {
    patchEnvServer();
    patchAuthOptions();
    patchEmailConfig();
    patchPackageJson();

    console.log('');
    console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.green}  SMTP Email patch complete!${colors.reset}`);
    console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log('');
    console.log(`  Patches: ${successCount}/${patchCount} successful`);
    console.log('');
    console.log('SMTP Configuration:');
    console.log(`  ${colors.yellow}SMTP_HOST${colors.reset}      - SMTP server hostname`);
    console.log(`  ${colors.yellow}SMTP_PORT${colors.reset}      - SMTP port (default: 587)`);
    console.log(`  ${colors.yellow}SMTP_TLS${colors.reset}       - Use TLS (true/false, default: false)`);
    console.log(`  ${colors.yellow}SMTP_USER${colors.reset}      - SMTP username`);
    console.log(`  ${colors.yellow}SMTP_PASSWORD${colors.reset}  - SMTP password`);
    console.log(`  ${colors.yellow}SMTP_FROM${colors.reset}      - Sender email address`);
    console.log(`  ${colors.yellow}SMTP_FROM_NAME${colors.reset} - Sender display name`);
    console.log('');
    console.log('Priority: SMTP > Resend > Console Log');
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
