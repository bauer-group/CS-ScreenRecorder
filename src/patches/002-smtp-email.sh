#!/bin/bash
###############################################################################
# SMTP Email Patch
# Replaces Resend cloud service with standard SMTP support
#
# This patch modifies:
# - packages/database/emails/config.ts (add SMTP transport)
# - packages/utils/src/server-env.ts (add SMTP env vars)
#
# Supports:
# - Standard SMTP with TLS/STARTTLS
# - Custom from name and address
# - Fallback to Resend if SMTP not configured
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="${APP_DIR:-/src}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  SMTP Email Support Patch${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# =============================================================================
# 1. Patch server-env.ts - Add SMTP environment variables
# =============================================================================
echo -e "${BLUE}[1/3] Patching server-env.ts...${NC}"

SERVER_ENV="$APP_DIR/packages/utils/src/server-env.ts"

if [ -f "$SERVER_ENV" ]; then
    if grep -q "SMTP_HOST" "$SERVER_ENV"; then
        echo -e "${YELLOW}  • SMTP env vars already exist${NC}"
    else
        # Add SMTP env vars after RESEND_FROM_DOMAIN
        sed -i 's/RESEND_FROM_DOMAIN: z.string().optional(),/RESEND_FROM_DOMAIN: z.string().optional(),\n  SMTP_HOST: z.string().optional(),\n  SMTP_PORT: z.coerce.number().optional().default(587),\n  SMTP_TLS: z.string().optional().default("false"),\n  SMTP_USER: z.string().optional(),\n  SMTP_PASSWORD: z.string().optional(),\n  SMTP_FROM: z.string().optional(),\n  SMTP_FROM_NAME: z.string().optional(),/' "$SERVER_ENV"
        echo -e "${GREEN}  ✓ Added SMTP environment variables${NC}"
    fi
else
    echo -e "${RED}  ✗ server-env.ts not found${NC}"
fi

# =============================================================================
# 2. Patch emails/config.ts - Add SMTP transport
# =============================================================================
echo -e "${BLUE}[2/3] Patching emails/config.ts...${NC}"

EMAIL_CONFIG="$APP_DIR/packages/database/emails/config.ts"

if [ -f "$EMAIL_CONFIG" ]; then
    if grep -q "nodemailer" "$EMAIL_CONFIG"; then
        echo -e "${YELLOW}  • SMTP/nodemailer already configured${NC}"
    else
        # Replace the entire config file with SMTP support
        cat > "$EMAIL_CONFIG" << 'CONFIGEOF'
import { serverEnv } from "@cap/utils";
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
    from = `${fromName} <${serverEnv().SMTP_FROM}>`;
  } else if (marketing) {
    from = "Richie from Cap <richie@send.cap.so>";
  } else if (serverEnv().NEXT_PUBLIC_IS_CAP) {
    from = "Cap Auth <no-reply@auth.cap.so>";
  } else if (serverEnv().RESEND_FROM_DOMAIN) {
    from = `${fromName} <auth@${serverEnv().RESEND_FROM_DOMAIN}>`;
  } else {
    from = `${fromName} <no-reply@example.com>`;
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
      console.log(`[SMTP] Email sent to ${to}: ${result.messageId}`);
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
  console.log(`  To: ${to}`);
  console.log(`  From: ${from}`);
  console.log(`  Subject: ${subject}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  return { success: true, messageId: "console-log" };
}
CONFIGEOF
        echo -e "${GREEN}  ✓ Added SMTP support to email config${NC}"
    fi
else
    echo -e "${RED}  ✗ emails/config.ts not found${NC}"
fi

# =============================================================================
# 3. Add nodemailer dependency to package.json
# =============================================================================
echo -e "${BLUE}[3/3] Adding nodemailer dependency...${NC}"

PACKAGE_JSON="$APP_DIR/packages/database/package.json"

if [ -f "$PACKAGE_JSON" ]; then
    if grep -q '"nodemailer"' "$PACKAGE_JSON"; then
        echo -e "${YELLOW}  • nodemailer already in dependencies${NC}"
    else
        # Add nodemailer to dependencies using node
        node << 'NODESCRIPT'
const fs = require('fs');
const file = process.env.APP_DIR + '/packages/database/package.json';

if (!fs.existsSync(file)) {
    console.log('  • package.json not found');
    process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies['nodemailer'] = '^6.9.0';
pkg.dependencies['@types/nodemailer'] = '^6.4.0';

fs.writeFileSync(file, JSON.stringify(pkg, null, 2));
console.log('  ✓ Added nodemailer to package.json');
NODESCRIPT
    fi
else
    echo -e "${YELLOW}  • package.json not found${NC}"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  SMTP Email patch complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "SMTP Configuration:"
echo -e "  ${YELLOW}SMTP_HOST${NC}      - SMTP server hostname"
echo -e "  ${YELLOW}SMTP_PORT${NC}      - SMTP port (default: 587)"
echo -e "  ${YELLOW}SMTP_TLS${NC}       - Use TLS (true/false, default: false)"
echo -e "  ${YELLOW}SMTP_USER${NC}      - SMTP username"
echo -e "  ${YELLOW}SMTP_PASSWORD${NC}  - SMTP password"
echo -e "  ${YELLOW}SMTP_FROM${NC}      - Sender email address"
echo -e "  ${YELLOW}SMTP_FROM_NAME${NC} - Sender display name"
echo ""
echo -e "Priority: SMTP > Resend > Console Log"
echo ""
