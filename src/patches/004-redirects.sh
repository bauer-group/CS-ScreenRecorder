#!/bin/bash
###############################################################################
# Redirects Patch
# Adds custom URL redirects to the Next.js application via middleware
#
# This patch creates or modifies:
# - apps/web/middleware.ts (Next.js middleware for redirects)
#
# Redirects added:
# - /download -> ${CAP_CLIENT_DOWNLOAD_URL} (302)
#   Default: https://cap.so/download
#   Custom: Set CAP_CLIENT_DOWNLOAD_URL env var (e.g., to your own S3 bucket)
# - /terms    -> https://go.bauer-group.com/screenrecorder-terms (302)
# - /privacy  -> https://go.bauer-group.com/screenrecorder-privacy (302)
#
# Using middleware is more reliable than modifying next.config.ts because:
# - Config files vary between Cap versions
# - Middleware is a standard Next.js feature
# - Easy to add multiple redirects
###############################################################################

set -e

# Terminal colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="${APP_DIR:-/src}"
MIDDLEWARE_FILE="$APP_DIR/apps/web/middleware.ts"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Redirects Patch (Middleware)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# =============================================================================
# Redirect code to inject (as a single block)
# Uses environment variable at runtime for flexible configuration
# =============================================================================
REDIRECT_BLOCK='
  // === Custom redirects (added by 004-redirects.sh patch) ===
  // Download redirect - uses CAP_CLIENT_DOWNLOAD_URL env var or defaults to cap.so
  if (request.nextUrl.pathname === "/download") {
    const downloadUrl = process.env.CAP_CLIENT_DOWNLOAD_URL || "https://cap.so/download";
    return NextResponse.redirect(new URL(downloadUrl), 302);
  }
  // Terms of Service redirect
  if (request.nextUrl.pathname === "/terms") {
    return NextResponse.redirect(new URL("https://go.bauer-group.com/screenrecorder-terms"), 302);
  }
  // Privacy Policy redirect
  if (request.nextUrl.pathname === "/privacy") {
    return NextResponse.redirect(new URL("https://go.bauer-group.com/screenrecorder-privacy"), 302);
  }
  // === End custom redirects ==='

# =============================================================================
# Check if middleware already exists
# =============================================================================
if [ -f "$MIDDLEWARE_FILE" ]; then
    echo -e "${BLUE}[1/2] Existing middleware found, checking...${NC}"

    # Check if our redirect is already there
    if grep -q 'cap.so/download' "$MIDDLEWARE_FILE"; then
        echo -e "${GREEN}  ✓ /download redirect already configured${NC}"
    else
        echo -e "${BLUE}  Injecting redirect into existing middleware...${NC}"

        # Create a temporary file with the patched content
        # Use awk for reliable multiline insertion (works on Alpine)
        awk -v redirect="$REDIRECT_BLOCK" '
        /export (async )?function middleware/ {
            print
            # Find the opening brace
            if (/{/) {
                print redirect
            }
            next
        }
        # If function declaration and brace are on separate lines
        /^[[:space:]]*{[[:space:]]*$/ && just_saw_middleware {
            print
            print redirect
            just_saw_middleware = 0
            next
        }
        /export (async )?function middleware/ { just_saw_middleware = 1 }
        {
            if (/export (async )?function middleware/ && !/{/) {
                just_saw_middleware = 1
            } else {
                just_saw_middleware = 0
            }
            print
        }
        ' "$MIDDLEWARE_FILE" > "${MIDDLEWARE_FILE}.tmp"

        # Check if awk succeeded and the redirect was added
        if grep -q 'cap.so/download' "${MIDDLEWARE_FILE}.tmp"; then
            mv "${MIDDLEWARE_FILE}.tmp" "$MIDDLEWARE_FILE"
            echo -e "${GREEN}  ✓ Injected redirect into existing middleware${NC}"
        else
            rm -f "${MIDDLEWARE_FILE}.tmp"
            echo -e "${YELLOW}  ! awk injection failed, trying alternative method...${NC}"

            # Alternative: prepend redirect check at the very beginning of file
            # This creates a new middleware that wraps the existing one
            ORIGINAL_CONTENT=$(cat "$MIDDLEWARE_FILE")
            cat > "$MIDDLEWARE_FILE" << 'WRAPPER_EOF'
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Custom redirect handler (added by 004-redirects.sh patch)
function handleCustomRedirects(request: NextRequest): NextResponse | null {
  if (request.nextUrl.pathname === "/download") {
    const downloadUrl = process.env.CAP_CLIENT_DOWNLOAD_URL || "https://cap.so/download";
    return NextResponse.redirect(new URL(downloadUrl), 302);
  }
  if (request.nextUrl.pathname === "/terms") {
    return NextResponse.redirect(new URL("https://go.bauer-group.com/screenrecorder-terms"), 302);
  }
  if (request.nextUrl.pathname === "/privacy") {
    return NextResponse.redirect(new URL("https://go.bauer-group.com/screenrecorder-privacy"), 302);
  }
  return null;
}

WRAPPER_EOF
            echo "$ORIGINAL_CONTENT" >> "$MIDDLEWARE_FILE"

            # Now inject call to handleCustomRedirects at the start of middleware function
            sed -i 's/export \(async \)\{0,1\}function middleware(\([^)]*\))[[:space:]]*{/export \1function middleware(\2) {\n  const customRedirect = handleCustomRedirects(request); if (customRedirect) return customRedirect;/' "$MIDDLEWARE_FILE"

            echo -e "${GREEN}  ✓ Added redirect wrapper to existing middleware${NC}"
        fi
    fi
else
    # =============================================================================
    # Create new middleware file
    # =============================================================================
    echo -e "${BLUE}[1/2] No existing middleware, creating new one...${NC}"

    cat > "$MIDDLEWARE_FILE" << 'MIDDLEWARE_EOF'
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Custom redirects (added by 004-redirects.sh patch)
 *
 * Environment variables:
 * - CAP_CLIENT_DOWNLOAD_URL: Override default download URL
 *   Default: https://cap.so/download
 *   Example: https://assets.screenrecorder.app.bauer-group.com/clients
 *
 * Static redirects:
 * - /terms   -> https://go.bauer-group.com/screenrecorder-terms
 * - /privacy -> https://go.bauer-group.com/screenrecorder-privacy
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /download redirect - uses environment variable for flexibility
  if (pathname === "/download") {
    const downloadUrl = process.env.CAP_CLIENT_DOWNLOAD_URL || "https://cap.so/download";
    return NextResponse.redirect(new URL(downloadUrl), 302);
  }

  // /terms redirect - Terms of Service
  if (pathname === "/terms") {
    return NextResponse.redirect(new URL("https://go.bauer-group.com/screenrecorder-terms"), 302);
  }

  // /privacy redirect - Privacy Policy
  if (pathname === "/privacy") {
    return NextResponse.redirect(new URL("https://go.bauer-group.com/screenrecorder-privacy"), 302);
  }

  // Continue with the request
  return NextResponse.next();
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    "/download",
    "/terms",
    "/privacy",
  ],
};
MIDDLEWARE_EOF

    echo -e "${GREEN}  ✓ Created middleware.ts with redirects${NC}"
fi

# =============================================================================
# Verify the middleware
# =============================================================================
echo -e "${BLUE}[2/2] Verifying middleware...${NC}"

if [ -f "$MIDDLEWARE_FILE" ]; then
    VERIFY_OK=true

    if grep -q 'cap.so/download' "$MIDDLEWARE_FILE"; then
        echo -e "${GREEN}  ✓ /download redirect configured${NC}"
    else
        echo -e "${RED}  ✗ /download redirect missing${NC}"
        VERIFY_OK=false
    fi

    if grep -q 'screenrecorder-terms' "$MIDDLEWARE_FILE"; then
        echo -e "${GREEN}  ✓ /terms redirect configured${NC}"
    else
        echo -e "${RED}  ✗ /terms redirect missing${NC}"
        VERIFY_OK=false
    fi

    if grep -q 'screenrecorder-privacy' "$MIDDLEWARE_FILE"; then
        echo -e "${GREEN}  ✓ /privacy redirect configured${NC}"
    else
        echo -e "${RED}  ✗ /privacy redirect missing${NC}"
        VERIFY_OK=false
    fi

    if [ "$VERIFY_OK" = false ]; then
        echo -e "${RED}    Manual intervention required${NC}"
        exit 1
    fi
else
    echo -e "${RED}  ✗ Middleware file not found after creation${NC}"
    exit 1
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Redirects patch complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Configured redirects (via middleware):"
echo -e "  ${YELLOW}/download${NC} → \${CAP_CLIENT_DOWNLOAD_URL} (302)"
echo -e "            Default: https://cap.so/download"
echo -e "  ${YELLOW}/terms${NC}    → https://go.bauer-group.com/screenrecorder-terms (302)"
echo -e "  ${YELLOW}/privacy${NC}  → https://go.bauer-group.com/screenrecorder-privacy (302)"
echo ""
