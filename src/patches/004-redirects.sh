#!/bin/bash
###############################################################################
# Redirects Patch
# Adds custom URL redirects via Next.js middleware
#
# This patch modifies:
# - apps/web/middleware.ts (Next.js middleware for redirects)
#
# Redirects added:
# - /terms    -> https://go.bauer-group.com/screenrecorder-terms (permanent)
# - /privacy  -> https://go.bauer-group.com/screenrecorder-privacy (permanent)
# - /download -> CAP_CLIENT_DOWNLOAD_URL env var (if set)
#
# Note: Middleware runs BEFORE page routes, so it takes precedence over
# existing /terms, /privacy, and /download pages.
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
echo -e "${BLUE}  Redirects Patch (middleware)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# =============================================================================
# Check if middleware.ts exists
# =============================================================================
if [ ! -f "$MIDDLEWARE_FILE" ]; then
    echo -e "${YELLOW}  ! No middleware.ts file found at $MIDDLEWARE_FILE${NC}"
    echo -e "${YELLOW}  ! Skipping redirects patch${NC}"
    exit 0
fi

echo -e "${BLUE}  Found: middleware.ts${NC}"

# =============================================================================
# Step 1: Add redirect paths to the matcher config
# =============================================================================
echo -e "${BLUE}[1/3] Adding redirect paths to matcher...${NC}"

# Check if our paths are already in the matcher
if grep -q '"/terms"' "$MIDDLEWARE_FILE" && grep -q '"/privacy"' "$MIDDLEWARE_FILE" && grep -q '"/download"' "$MIDDLEWARE_FILE"; then
    echo -e "${GREEN}  ✓ Redirect paths already in matcher${NC}"
else
    # Find the matcher array and add our paths
    # Look for pattern like: matcher: [...existing paths...]
    # We need to add /terms, /privacy, /download to the array

    if grep -q 'matcher:' "$MIDDLEWARE_FILE"; then
        # Add paths to the beginning of the matcher array
        sed -i 's/matcher: *\[/matcher: [\n    "\/terms",\n    "\/privacy",\n    "\/download",/' "$MIDDLEWARE_FILE"
        echo -e "${GREEN}  ✓ Added redirect paths to matcher${NC}"
    else
        echo -e "${YELLOW}  ! Could not find matcher config${NC}"
    fi
fi

# =============================================================================
# Step 2: Add redirect handler at the start of the middleware function
# =============================================================================
echo -e "${BLUE}[2/3] Adding redirect handler to middleware...${NC}"

# Check if redirect handler already exists
if grep -q 'screenrecorder-terms' "$MIDDLEWARE_FILE"; then
    echo -e "${GREEN}  ✓ Redirect handler already configured${NC}"
else
    # Find the middleware function and add our redirect logic at the start
    # We need to insert our code right after the function definition

    # Create the redirect handler code
    REDIRECT_CODE='
  // === Custom redirects (added by 004-redirects.sh) ===
  const customRedirects: { [key: string]: string | undefined } = {
    "/terms": "https://go.bauer-group.com/screenrecorder-terms",
    "/privacy": "https://go.bauer-group.com/screenrecorder-privacy",
    "/download": process.env.CAP_CLIENT_DOWNLOAD_URL,
  };

  const pathname = request.nextUrl.pathname;
  const redirectUrl = customRedirects[pathname];

  if (redirectUrl) {
    // For /download, fall through if no URL is configured
    if (pathname === "/download" && !redirectUrl) {
      // Let Cap handle the default /download page
    } else {
      return NextResponse.redirect(redirectUrl, { status: 302 });
    }
  }
  // === End custom redirects ==='

    # Find the middleware function body start and insert our code
    # Pattern: export async function middleware(request: NextRequest) {
    # Or: export function middleware(request

    if grep -q 'export.*function middleware' "$MIDDLEWARE_FILE"; then
        # Insert after the opening brace of the middleware function
        # Use awk for more reliable multi-line insertion
        awk '
        /export.*function middleware.*\{/ {
            print $0
            print "  // === Custom redirects (added by 004-redirects.sh) ==="
            print "  const customRedirects: { [key: string]: string | undefined } = {"
            print "    \"/terms\": \"https://go.bauer-group.com/screenrecorder-terms\","
            print "    \"/privacy\": \"https://go.bauer-group.com/screenrecorder-privacy\","
            print "    \"/download\": process.env.CAP_CLIENT_DOWNLOAD_URL,"
            print "  };"
            print "  "
            print "  const pathname = request.nextUrl.pathname;"
            print "  const redirectUrl = customRedirects[pathname];"
            print "  "
            print "  if (redirectUrl) {"
            print "    return NextResponse.redirect(redirectUrl, { status: 302 });"
            print "  }"
            print "  // === End custom redirects ==="
            print ""
            next
        }
        { print }
        ' "$MIDDLEWARE_FILE" > "$MIDDLEWARE_FILE.tmp" && mv "$MIDDLEWARE_FILE.tmp" "$MIDDLEWARE_FILE"

        echo -e "${GREEN}  ✓ Added redirect handler to middleware${NC}"
    else
        echo -e "${YELLOW}  ! Could not find middleware function${NC}"
    fi
fi

# =============================================================================
# Step 3: Verify the configuration
# =============================================================================
echo -e "${BLUE}[3/3] Verifying configuration...${NC}"

VERIFY_OK=true

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

if grep -q 'CAP_CLIENT_DOWNLOAD_URL' "$MIDDLEWARE_FILE"; then
    echo -e "${GREEN}  ✓ /download redirect configured${NC}"
else
    echo -e "${RED}  ✗ /download redirect missing${NC}"
    VERIFY_OK=false
fi

if [ "$VERIFY_OK" = false ]; then
    echo -e "${YELLOW}  ! Some redirects may need manual configuration${NC}"
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
echo -e "  ${YELLOW}/terms${NC}    → https://go.bauer-group.com/screenrecorder-terms (302)"
echo -e "  ${YELLOW}/privacy${NC}  → https://go.bauer-group.com/screenrecorder-privacy (302)"
echo -e "  ${YELLOW}/download${NC} → CAP_CLIENT_DOWNLOAD_URL environment variable (302)"
echo ""
