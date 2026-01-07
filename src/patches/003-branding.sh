#!/bin/bash
###############################################################################
# Branding Patch
# Customizes app name, company name, description and colors in the source code
#
# This patch modifies:
# - apps/web/app/layout.tsx (metadata title, description, OG tags)
# - apps/web/app/globals.css (CSS color variables)
# - Various UI components that display "Cap" branding
#
# Configuration via environment variables (with defaults):
#   BRAND_APP_NAME      - Application name (default: "Screen Recorder")
#   BRAND_COMPANY_NAME  - Company name (default: "BAUER GROUP")
#   BRAND_DESCRIPTION   - App description
#   BRAND_PRIMARY_*     - Primary color variants
#   BRAND_SECONDARY_*   - Secondary color variants
###############################################################################

set -e

# Terminal colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="${APP_DIR:-/src}"
BRANDING_ENV="${BRANDING_ENV:-/branding/branding.env}"

# =============================================================================
# Load branding.env if available (allows external configuration)
# =============================================================================
if [ -f "$BRANDING_ENV" ]; then
    echo -e "${BLUE}Loading branding configuration from $BRANDING_ENV${NC}"
    # shellcheck source=/dev/null
    source "$BRANDING_ENV"
fi

# =============================================================================
# Branding Text Configuration (with defaults)
# =============================================================================
BRAND_APP_NAME="${BRAND_APP_NAME:-Screen Recorder}"
BRAND_COMPANY_NAME="${BRAND_COMPANY_NAME:-BAUER GROUP}"
BRAND_DESCRIPTION="${BRAND_APP_DESCRIPTION:-${BRAND_DESCRIPTION:-A screen recording solution by ${BRAND_COMPANY_NAME}.}}"
BRAND_FULL_NAME="${BRAND_APP_NAME} [${BRAND_COMPANY_NAME}]"

# =============================================================================
# BAUER GROUP Color System
# Primary: Orange (#FF8500)
# Values loaded from branding.env or use defaults
# =============================================================================

# Primary Colors (Orange) - mapped from BRAND_ORANGE_* or BRAND_THEME_COLOR
BRAND_PRIMARY="${BRAND_THEME_COLOR:-#FF8500}"
BRAND_PRIMARY_2="${BRAND_ORANGE_600:-#EA6D00}"
BRAND_PRIMARY_3="${BRAND_ORANGE_700:-#C2570A}"

# Secondary Colors (Orange variants for consistency)
BRAND_SECONDARY="${BRAND_ORANGE_400:-#FB923C}"
BRAND_SECONDARY_2="${BRAND_ORANGE_300:-#FDBA74}"
BRAND_SECONDARY_3="${BRAND_ORANGE_200:-#FED7AA}"

# Tertiary Colors (Light orange tints)
BRAND_TERTIARY="${BRAND_ORANGE_100:-#FFEDD5}"
BRAND_TERTIARY_2="${BRAND_ORANGE_50:-#FFF7ED}"
BRAND_TERTIARY_3="#FFFBF5"

# Filler/Neutral Colors
BRAND_FILLER="${BRAND_GRAY_100:-#F4F4F5}"
BRAND_FILLER_2="${BRAND_GRAY_200:-#E4E4E7}"
BRAND_FILLER_3="${BRAND_GRAY_300:-#D4D4D8}"
BRAND_FILLER_TXT="${BRAND_GRAY_500:-#71717A}"

# Text Colors
BRAND_TEXT_PRIMARY_CSS="${BRAND_TEXT_PRIMARY:-#18181B}"
BRAND_TEXT_SECONDARY_CSS="${BRAND_THEME_FOREGROUND:-#FFFFFF}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Branding Patch${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  App Name:      ${GREEN}${BRAND_FULL_NAME}${NC}"
echo -e "  Company:       ${GREEN}${BRAND_COMPANY_NAME}${NC}"
echo -e "  Primary Color: ${GREEN}${BRAND_PRIMARY}${NC} (Orange)"
echo ""

# =============================================================================
# 1. Patch globals.css - Update CSS color variables
# =============================================================================
echo -e "${BLUE}[1/4] Patching apps/web/app/globals.css...${NC}"

GLOBALS_CSS="$APP_DIR/apps/web/app/globals.css"

if [ -f "$GLOBALS_CSS" ]; then
    # Replace primary colors (Cap blue -> BAUER orange)
    sed -i "s/--primary: #005cb1;/--primary: ${BRAND_PRIMARY};/g" "$GLOBALS_CSS"
    sed -i "s/--primary-2: #004c93;/--primary-2: ${BRAND_PRIMARY_2};/g" "$GLOBALS_CSS"
    sed -i "s/--primary-3: #003b73;/--primary-3: ${BRAND_PRIMARY_3};/g" "$GLOBALS_CSS"

    # Replace secondary colors
    sed -i "s/--secondary: #2eb4ff;/--secondary: ${BRAND_SECONDARY};/g" "$GLOBALS_CSS"
    sed -i "s/--secondary-2: #1696e0;/--secondary-2: ${BRAND_SECONDARY_2};/g" "$GLOBALS_CSS"
    sed -i "s/--secondary-3: #117ebd;/--secondary-3: ${BRAND_SECONDARY_3};/g" "$GLOBALS_CSS"

    # Replace tertiary colors
    sed -i "s/--tertiary: #c5eaff;/--tertiary: ${BRAND_TERTIARY};/g" "$GLOBALS_CSS"
    sed -i "s/--tertiary-2: #d3e5ff;/--tertiary-2: ${BRAND_TERTIARY_2};/g" "$GLOBALS_CSS"
    sed -i "s/--tertiary-3: #e0edff;/--tertiary-3: ${BRAND_TERTIARY_3};/g" "$GLOBALS_CSS"

    # Replace filler/neutral colors
    sed -i "s/--filler: #efefef;/--filler: ${BRAND_FILLER};/g" "$GLOBALS_CSS"
    sed -i "s/--filler-2: #e4e4e4;/--filler-2: ${BRAND_FILLER_2};/g" "$GLOBALS_CSS"
    sed -i "s/--filler-3: #e2e2e2;/--filler-3: ${BRAND_FILLER_3};/g" "$GLOBALS_CSS"
    sed -i "s/--filler-txt: #b3b3b3;/--filler-txt: ${BRAND_FILLER_TXT};/g" "$GLOBALS_CSS"

    # Replace text colors
    sed -i "s/--text-primary: #0d1b2a;/--text-primary: ${BRAND_TEXT_PRIMARY_CSS};/g" "$GLOBALS_CSS"
    sed -i "s/--text-secondary: #ffffff;/--text-secondary: ${BRAND_TEXT_SECONDARY_CSS};/g" "$GLOBALS_CSS"

    echo -e "${GREEN}  ✓ Updated CSS color variables${NC}"
else
    echo -e "${RED}  ✗ globals.css not found${NC}"
fi

# =============================================================================
# 2. Patch layout.tsx - Update metadata
# =============================================================================
echo -e "${BLUE}[2/4] Patching apps/web/app/layout.tsx...${NC}"

LAYOUT_FILE="$APP_DIR/apps/web/app/layout.tsx"

if [ -f "$LAYOUT_FILE" ]; then
    # Replace the title
    sed -i "s/title: \"Cap — Beautiful screen recordings, owned by you.\"/title: \"${BRAND_FULL_NAME}\"/g" "$LAYOUT_FILE"

    # Replace the description
    sed -i "s/description: \"Cap is the open source alternative to Loom. Lightweight, powerful, and cross-platform. Record and share in seconds.\"/description: \"${BRAND_DESCRIPTION}\"/g" "$LAYOUT_FILE"

    # Replace OG title if different
    sed -i "s/title: \"Cap — Beautiful screen recordings, owned by you.\"/title: \"${BRAND_FULL_NAME}\"/g" "$LAYOUT_FILE"

    echo -e "${GREEN}  ✓ Updated metadata in layout.tsx${NC}"
else
    echo -e "${RED}  ✗ layout.tsx not found${NC}"
fi

# =============================================================================
# 3. Patch package.json - Update app name
# =============================================================================
echo -e "${BLUE}[3/4] Patching apps/web/package.json...${NC}"

WEB_PACKAGE="$APP_DIR/apps/web/package.json"

if [ -f "$WEB_PACKAGE" ]; then
    # Update the name field using node for safe JSON manipulation
    node << NODESCRIPT
const fs = require('fs');
const file = '${WEB_PACKAGE}';

if (!fs.existsSync(file)) {
    console.log('  • package.json not found');
    process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.description = '${BRAND_DESCRIPTION}';

fs.writeFileSync(file, JSON.stringify(pkg, null, 2));
console.log('  ✓ Updated package.json description');
NODESCRIPT
else
    echo -e "${YELLOW}  • package.json not found${NC}"
fi

# =============================================================================
# 4. Patch site config if exists
# =============================================================================
echo -e "${BLUE}[4/4] Searching for additional branding locations...${NC}"

# Look for common config files that might contain branding
SITE_CONFIG="$APP_DIR/apps/web/config/site.ts"
if [ -f "$SITE_CONFIG" ]; then
    sed -i "s/name: \"Cap\"/name: \"${BRAND_APP_NAME}\"/g" "$SITE_CONFIG"
    sed -i "s/name: 'Cap'/name: '${BRAND_APP_NAME}'/g" "$SITE_CONFIG"
    echo -e "${GREEN}  ✓ Updated site config${NC}"
fi

# Update any hardcoded "Cap" references in common UI locations
# Be careful to only replace standalone "Cap" not "Cap" as part of other words

# Footer copyright
find "$APP_DIR/apps/web" -name "*.tsx" -type f -exec grep -l "© Cap" {} \; 2>/dev/null | while read file; do
    sed -i "s/© Cap/© ${BRAND_COMPANY_NAME}/g" "$file"
    echo -e "${GREEN}  ✓ Updated copyright in $(basename "$file")${NC}"
done

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Branding patch complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Applied branding:"
echo -e "  ${YELLOW}App Name${NC}:    ${BRAND_FULL_NAME}"
echo -e "  ${YELLOW}Company${NC}:     ${BRAND_COMPANY_NAME}"
echo -e "  ${YELLOW}Description${NC}: ${BRAND_DESCRIPTION}"
echo ""
