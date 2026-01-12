#!/bin/bash
###############################################################################
# Branding Patch
# Customizes app name, company name, description and colors in the source code
#
# This patch modifies:
# - apps/web/app/layout.tsx (metadata title, description, OG tags)
# - apps/web/app/globals.css (CSS color variables - both Hex AND HSL)
# - Various UI components that display "Cap" branding
#
# Cap uses shadcn/ui which requires HSL color values in @layer base
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
# Primary: Orange (#FF8500) = HSL(32, 100%, 50%)
# =============================================================================

# Hex Colors (for legacy CSS)
BRAND_PRIMARY="${BRAND_THEME_COLOR:-#FF8500}"
BRAND_PRIMARY_2="${BRAND_ORANGE_600:-#EA6D00}"
BRAND_PRIMARY_3="${BRAND_ORANGE_700:-#C2570A}"
BRAND_SECONDARY="${BRAND_ORANGE_400:-#FB923C}"
BRAND_SECONDARY_2="${BRAND_ORANGE_300:-#FDBA74}"
BRAND_SECONDARY_3="${BRAND_ORANGE_200:-#FED7AA}"
BRAND_TERTIARY="${BRAND_ORANGE_100:-#FFEDD5}"
BRAND_TERTIARY_2="${BRAND_ORANGE_50:-#FFF7ED}"

# HSL Colors for shadcn/ui (without hsl() wrapper, just values)
# Orange #FF8500 = hsl(32, 100%, 50%)
BRAND_PRIMARY_HSL="32 100% 50%"
BRAND_PRIMARY_FOREGROUND_HSL="0 0% 100%"
# Lighter orange for secondary/accent
BRAND_SECONDARY_HSL="32 95% 95%"
BRAND_SECONDARY_FOREGROUND_HSL="32 100% 25%"
BRAND_ACCENT_HSL="32 95% 95%"
BRAND_ACCENT_FOREGROUND_HSL="32 100% 25%"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Branding Patch${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  App Name:      ${GREEN}${BRAND_FULL_NAME}${NC}"
echo -e "  Company:       ${GREEN}${BRAND_COMPANY_NAME}${NC}"
echo -e "  Primary Color: ${GREEN}${BRAND_PRIMARY}${NC} (Orange)"
echo -e "  Primary HSL:   ${GREEN}${BRAND_PRIMARY_HSL}${NC}"
echo ""

# =============================================================================
# 1. Patch globals.css - Update ALL CSS color variables (Hex AND HSL)
# =============================================================================
echo -e "${BLUE}[1/5] Patching apps/web/app/globals.css...${NC}"

GLOBALS_CSS="$APP_DIR/apps/web/app/globals.css"

if [ -f "$GLOBALS_CSS" ]; then
    # -------------------------------------------------------------------------
    # Part A: Replace legacy Hex color variables (if they exist)
    # -------------------------------------------------------------------------
    sed -i "s/--primary: #005cb1;/--primary: ${BRAND_PRIMARY};/g" "$GLOBALS_CSS"
    sed -i "s/--primary-2: #004c93;/--primary-2: ${BRAND_PRIMARY_2};/g" "$GLOBALS_CSS"
    sed -i "s/--primary-3: #003b73;/--primary-3: ${BRAND_PRIMARY_3};/g" "$GLOBALS_CSS"
    sed -i "s/--secondary: #2eb4ff;/--secondary: ${BRAND_SECONDARY};/g" "$GLOBALS_CSS"
    sed -i "s/--secondary-2: #1696e0;/--secondary-2: ${BRAND_SECONDARY_2};/g" "$GLOBALS_CSS"
    sed -i "s/--secondary-3: #117ebd;/--secondary-3: ${BRAND_SECONDARY_3};/g" "$GLOBALS_CSS"
    sed -i "s/--tertiary: #c5eaff;/--tertiary: ${BRAND_TERTIARY};/g" "$GLOBALS_CSS"
    sed -i "s/--tertiary-2: #d3e5ff;/--tertiary-2: ${BRAND_TERTIARY_2};/g" "$GLOBALS_CSS"
    sed -i "s/--tertiary-3: #e0edff;/--tertiary-3: #FFF7ED;/g" "$GLOBALS_CSS"
    echo -e "${GREEN}  ✓ Updated Hex color variables${NC}"

    # -------------------------------------------------------------------------
    # Part B: Replace shadcn/ui HSL color variables in @layer base
    # These are the IMPORTANT ones that affect buttons, toggles, etc.
    # -------------------------------------------------------------------------

    # Primary color (main brand color - buttons, links, etc.)
    # Original: --primary: 220.9 39.3% 11%;
    sed -i "s/--primary: 220.9 39.3% 11%;/--primary: ${BRAND_PRIMARY_HSL};/g" "$GLOBALS_CSS"
    sed -i "s/--primary: 220\.9 39\.3% 11%;/--primary: ${BRAND_PRIMARY_HSL};/g" "$GLOBALS_CSS"

    # Primary foreground (text on primary color)
    # Original: --primary-foreground: 210 20% 98%;
    sed -i "s/--primary-foreground: 210 20% 98%;/--primary-foreground: ${BRAND_PRIMARY_FOREGROUND_HSL};/g" "$GLOBALS_CSS"

    # Secondary color (secondary buttons, badges)
    # Original: --secondary: 220 14.3% 95.9%;
    sed -i "s/--secondary: 220 14.3% 95.9%;/--secondary: ${BRAND_SECONDARY_HSL};/g" "$GLOBALS_CSS"
    sed -i "s/--secondary: 220 14\.3% 95\.9%;/--secondary: ${BRAND_SECONDARY_HSL};/g" "$GLOBALS_CSS"

    # Secondary foreground
    # Original: --secondary-foreground: 220.9 39.3% 11%;
    sed -i "s/--secondary-foreground: 220.9 39.3% 11%;/--secondary-foreground: ${BRAND_SECONDARY_FOREGROUND_HSL};/g" "$GLOBALS_CSS"
    sed -i "s/--secondary-foreground: 220\.9 39\.3% 11%;/--secondary-foreground: ${BRAND_SECONDARY_FOREGROUND_HSL};/g" "$GLOBALS_CSS"

    # Accent color (hover states, highlights)
    # Original: --accent: 220 14.3% 95.9%;
    sed -i "s/--accent: 220 14.3% 95.9%;/--accent: ${BRAND_ACCENT_HSL};/g" "$GLOBALS_CSS"
    sed -i "s/--accent: 220 14\.3% 95\.9%;/--accent: ${BRAND_ACCENT_HSL};/g" "$GLOBALS_CSS"

    # Accent foreground
    # Original: --accent-foreground: 220.9 39.3% 11%;
    sed -i "s/--accent-foreground: 220.9 39.3% 11%;/--accent-foreground: ${BRAND_ACCENT_FOREGROUND_HSL};/g" "$GLOBALS_CSS"
    sed -i "s/--accent-foreground: 220\.9 39\.3% 11%;/--accent-foreground: ${BRAND_ACCENT_FOREGROUND_HSL};/g" "$GLOBALS_CSS"

    # Ring color (focus rings)
    # Original: --ring: 224 71.4% 4.1%;
    sed -i "s/--ring: 224 71.4% 4.1%;/--ring: ${BRAND_PRIMARY_HSL};/g" "$GLOBALS_CSS"
    sed -i "s/--ring: 224 71\.4% 4\.1%;/--ring: ${BRAND_PRIMARY_HSL};/g" "$GLOBALS_CSS"

    # -------------------------------------------------------------------------
    # Part C: Replace Dark Mode HSL color variables (.dark class)
    # These affect buttons and UI elements in dark mode!
    # -------------------------------------------------------------------------

    # Dark mode primary (text on dark background - keep light for contrast)
    # Original: --primary: 210 20% 98%;
    sed -i "s/--primary: 210 20% 98%;/--primary: ${BRAND_PRIMARY_FOREGROUND_HSL};/g" "$GLOBALS_CSS"

    # Dark mode secondary
    # Original: --secondary: 215 27.9% 16.9%;
    sed -i "s/--secondary: 215 27.9% 16.9%;/--secondary: 32 30% 15%;/g" "$GLOBALS_CSS"
    sed -i "s/--secondary: 215 27\.9% 16\.9%;/--secondary: 32 30% 15%;/g" "$GLOBALS_CSS"

    # Dark mode secondary foreground
    # Original: --secondary-foreground: 210 20% 98%;
    sed -i "s/--secondary-foreground: 210 20% 98%;/--secondary-foreground: ${BRAND_PRIMARY_FOREGROUND_HSL};/g" "$GLOBALS_CSS"

    # Dark mode ring
    # Original: --ring: 216 12.2% 83.9%;
    sed -i "s/--ring: 216 12.2% 83.9%;/--ring: ${BRAND_PRIMARY_HSL};/g" "$GLOBALS_CSS"
    sed -i "s/--ring: 216 12\.2% 83\.9%;/--ring: ${BRAND_PRIMARY_HSL};/g" "$GLOBALS_CSS"

    # Dark mode accent
    # Original: --accent: 215 27.9% 16.9%;
    sed -i "s/--accent: 215 27.9% 16.9%;/--accent: 32 30% 15%;/g" "$GLOBALS_CSS"
    sed -i "s/--accent: 215 27\.9% 16\.9%;/--accent: 32 30% 15%;/g" "$GLOBALS_CSS"

    # Dark mode accent foreground
    # Original: --accent-foreground: 210 20% 98%;
    sed -i "s/--accent-foreground: 210 20% 98%;/--accent-foreground: ${BRAND_PRIMARY_FOREGROUND_HSL};/g" "$GLOBALS_CSS"

    # Dark mode border (blue-ish gray to neutral)
    # Original: --border: 215 27.9% 16.9%;
    sed -i "s/--border: 215 27.9% 16.9%;/--border: 32 10% 20%;/g" "$GLOBALS_CSS"
    sed -i "s/--border: 215 27\.9% 16\.9%;/--border: 32 10% 20%;/g" "$GLOBALS_CSS"

    # Dark mode input
    # Original: --input: 215 27.9% 16.9%;
    sed -i "s/--input: 215 27.9% 16.9%;/--input: 32 10% 20%;/g" "$GLOBALS_CSS"
    sed -i "s/--input: 215 27\.9% 16\.9%;/--input: 32 10% 20%;/g" "$GLOBALS_CSS"

    # Dark mode chart colors (blue -> orange)
    # Original: --chart-1: 220 70% 50%;
    sed -i "s/--chart-1: 220 70% 50%;/--chart-1: ${BRAND_PRIMARY_HSL};/g" "$GLOBALS_CSS"

    echo -e "${GREEN}  ✓ Updated dark mode HSL color variables${NC}"

    # -------------------------------------------------------------------------
    # Part D: Replace Light Mode border/input colors (subtle blue tint -> neutral)
    # -------------------------------------------------------------------------

    # Light mode border (blue-ish gray to neutral gray)
    # Original: --border: 220 13% 91%;
    sed -i "s/--border: 220 13% 91%;/--border: 0 0% 90%;/g" "$GLOBALS_CSS"

    # Light mode input
    # Original: --input: 220 13% 91%;
    sed -i "s/--input: 220 13% 91%;/--input: 0 0% 90%;/g" "$GLOBALS_CSS"

    # Light mode chart-3 (dark blue -> dark orange)
    # Original: --chart-3: 197 37% 24%;
    sed -i "s/--chart-3: 197 37% 24%;/--chart-3: 32 80% 30%;/g" "$GLOBALS_CSS"

    echo -e "${GREEN}  ✓ Updated light mode border/input colors${NC}"

    echo -e "${GREEN}  ✓ Updated shadcn/ui HSL color variables${NC}"
else
    echo -e "${RED}  ✗ globals.css not found${NC}"
fi

# =============================================================================
# 2. Patch layout.tsx - Update metadata
# =============================================================================
echo -e "${BLUE}[2/5] Patching apps/web/app/layout.tsx...${NC}"

LAYOUT_FILE="$APP_DIR/apps/web/app/layout.tsx"

if [ -f "$LAYOUT_FILE" ]; then
    # Replace the title (handle various quote styles)
    sed -i "s/title: \"Cap — Beautiful screen recordings, owned by you.\"/title: \"${BRAND_FULL_NAME}\"/g" "$LAYOUT_FILE"
    sed -i "s/title: 'Cap — Beautiful screen recordings, owned by you.'/title: '${BRAND_FULL_NAME}'/g" "$LAYOUT_FILE"

    # Replace the description
    sed -i "s/description: \"Cap is the open source alternative to Loom. Lightweight, powerful, and cross-platform. Record and share in seconds.\"/description: \"${BRAND_DESCRIPTION}\"/g" "$LAYOUT_FILE"

    echo -e "${GREEN}  ✓ Updated metadata in layout.tsx${NC}"
else
    echo -e "${RED}  ✗ layout.tsx not found${NC}"
fi

# =============================================================================
# 3. Replace "Cap" branding text throughout the codebase
# =============================================================================
echo -e "${BLUE}[3/5] Replacing 'Cap' branding text...${NC}"

# Files to search for Cap branding
SEARCH_DIR="$APP_DIR/apps/web"

# Replace "Cap Pro" with app name
find "$SEARCH_DIR" -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) 2>/dev/null | while read file; do
    if grep -q "Cap Pro" "$file" 2>/dev/null; then
        sed -i "s/Cap Pro/${BRAND_APP_NAME}/g" "$file"
        echo -e "${GREEN}  ✓ Replaced 'Cap Pro' in $(basename "$file")${NC}"
    fi
done

# Replace "Cap Software, Inc." with company name
find "$SEARCH_DIR" -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | while read file; do
    if grep -q "Cap Software" "$file" 2>/dev/null; then
        sed -i "s/Cap Software, Inc\./${BRAND_COMPANY_NAME}/g" "$file"
        sed -i "s/Cap Software/${BRAND_COMPANY_NAME}/g" "$file"
        echo -e "${GREEN}  ✓ Replaced 'Cap Software' in $(basename "$file")${NC}"
    fi
done

# Replace copyright
find "$SEARCH_DIR" -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | while read file; do
    if grep -q "© Cap" "$file" 2>/dev/null; then
        sed -i "s/© Cap/© ${BRAND_COMPANY_NAME}/g" "$file"
        echo -e "${GREEN}  ✓ Replaced copyright in $(basename "$file")${NC}"
    fi
done

# Replace "Cap Settings" section headers
find "$SEARCH_DIR" -type f \( -name "*.tsx" -o -name "*.ts" \) 2>/dev/null | while read file; do
    if grep -q "Cap Settings" "$file" 2>/dev/null; then
        sed -i "s/Cap Settings/${BRAND_APP_NAME} Settings/g" "$file"
        echo -e "${GREEN}  ✓ Replaced 'Cap Settings' in $(basename "$file")${NC}"
    fi
done

# =============================================================================
# 4. Patch LogoSpinner component - Replace blue colors with orange
# =============================================================================
echo -e "${BLUE}[4/5] Patching LogoSpinner colors...${NC}"

# LogoSpinner.tsx is in packages/ui/src/components/
LOGO_SPINNER="$APP_DIR/packages/ui/src/components/LogoSpinner.tsx"

if [ -f "$LOGO_SPINNER" ]; then
    # Replace blue colors with orange
    # Original: #4785FF (bright blue outer circle) -> #FF8500 (BAUER orange)
    # Original: #ADC9FF (light blue middle ring) -> #FDBA74 (light orange)

    sed -i 's/#4785FF/#FF8500/g' "$LOGO_SPINNER"
    sed -i 's/#4785ff/#FF8500/g' "$LOGO_SPINNER"
    sed -i 's/#ADC9FF/#FDBA74/g' "$LOGO_SPINNER"
    sed -i 's/#adc9ff/#FDBA74/g' "$LOGO_SPINNER"

    echo -e "${GREEN}  ✓ Updated LogoSpinner colors (blue → orange)${NC}"
else
    echo -e "${YELLOW}  • LogoSpinner.tsx not found at expected location${NC}"
    # Try to find it elsewhere
    FOUND_LOGO=$(find "$APP_DIR" -name "LogoSpinner.tsx" -type f 2>/dev/null | head -1)
    if [ -n "$FOUND_LOGO" ]; then
        sed -i 's/#4785FF/#FF8500/g' "$FOUND_LOGO"
        sed -i 's/#4785ff/#FF8500/g' "$FOUND_LOGO"
        sed -i 's/#ADC9FF/#FDBA74/g' "$FOUND_LOGO"
        sed -i 's/#adc9ff/#FDBA74/g' "$FOUND_LOGO"
        echo -e "${GREEN}  ✓ Found and updated LogoSpinner at: $FOUND_LOGO${NC}"
    fi
fi

# Also patch any other logo files that might exist
find "$APP_DIR" -type f -name "*.tsx" 2>/dev/null | xargs grep -l "#4785FF\|#4785ff" 2>/dev/null | while read file; do
    sed -i 's/#4785FF/#FF8500/g' "$file"
    sed -i 's/#4785ff/#FF8500/g' "$file"
    sed -i 's/#ADC9FF/#FDBA74/g' "$file"
    sed -i 's/#adc9ff/#FDBA74/g' "$file"
    echo -e "${GREEN}  ✓ Updated colors in $(basename "$file")${NC}"
done

# =============================================================================
# 4b. Patch Button.tsx - Replace blue variants with orange
# =============================================================================
echo -e "${BLUE}[4b/5] Patching Button component blue variants...${NC}"

BUTTON_TSX="$APP_DIR/packages/ui/src/components/Button.tsx"

if [ -f "$BUTTON_TSX" ]; then
    # Replace Tailwind blue classes with orange equivalents
    # blue variant: bg-blue-600 -> bg-orange-500, border-blue-800 -> border-orange-700, hover:bg-blue-700 -> hover:bg-orange-600
    sed -i 's/bg-blue-600/bg-orange-500/g' "$BUTTON_TSX"
    sed -i 's/border-blue-800/border-orange-700/g' "$BUTTON_TSX"
    sed -i 's/hover:bg-blue-700/hover:bg-orange-600/g' "$BUTTON_TSX"

    # radialblue variant hex colors
    # #9BC4FF (light blue) -> #FDBA74 (light orange)
    # #3588FF (standard blue) -> #FF8500 (BAUER orange)
    sed -i 's/#9BC4FF/#FDBA74/g' "$BUTTON_TSX"
    sed -i 's/#9bc4ff/#FDBA74/g' "$BUTTON_TSX"
    sed -i 's/#3588FF/#FF8500/g' "$BUTTON_TSX"
    sed -i 's/#3588ff/#FF8500/g' "$BUTTON_TSX"

    # shadow-blue-400 -> shadow-orange-400
    sed -i 's/shadow-blue-400/shadow-orange-400/g' "$BUTTON_TSX"

    echo -e "${GREEN}  ✓ Updated Button blue variants (blue → orange)${NC}"
else
    echo -e "${YELLOW}  • Button.tsx not found at expected location${NC}"
    # Try to find it elsewhere
    FOUND_BUTTON=$(find "$APP_DIR" -name "Button.tsx" -path "*/ui/*" -type f 2>/dev/null | head -1)
    if [ -n "$FOUND_BUTTON" ]; then
        sed -i 's/bg-blue-600/bg-orange-500/g' "$FOUND_BUTTON"
        sed -i 's/border-blue-800/border-orange-700/g' "$FOUND_BUTTON"
        sed -i 's/hover:bg-blue-700/hover:bg-orange-600/g' "$FOUND_BUTTON"
        sed -i 's/#9BC4FF/#FDBA74/g' "$FOUND_BUTTON"
        sed -i 's/#9bc4ff/#FDBA74/g' "$FOUND_BUTTON"
        sed -i 's/#3588FF/#FF8500/g' "$FOUND_BUTTON"
        sed -i 's/#3588ff/#FF8500/g' "$FOUND_BUTTON"
        sed -i 's/shadow-blue-400/shadow-orange-400/g' "$FOUND_BUTTON"
        echo -e "${GREEN}  ✓ Found and updated Button at: $FOUND_BUTTON${NC}"
    fi
fi

# Also find and patch any other components using blue Tailwind classes for buttons
echo -e "${BLUE}    Searching for other blue button usages...${NC}"
find "$APP_DIR" -type f \( -name "*.tsx" -o -name "*.jsx" \) 2>/dev/null | xargs grep -l "bg-blue-\|text-blue-\|border-blue-" 2>/dev/null | while read file; do
    # Replace common blue button patterns with orange
    sed -i 's/bg-blue-500/bg-orange-500/g' "$file"
    sed -i 's/bg-blue-600/bg-orange-500/g' "$file"
    sed -i 's/bg-blue-700/bg-orange-600/g' "$file"
    sed -i 's/hover:bg-blue-600/hover:bg-orange-600/g' "$file"
    sed -i 's/hover:bg-blue-700/hover:bg-orange-600/g' "$file"
    sed -i 's/border-blue-500/border-orange-500/g' "$file"
    sed -i 's/border-blue-600/border-orange-600/g' "$file"
    sed -i 's/border-blue-700/border-orange-700/g' "$file"
    sed -i 's/border-blue-800/border-orange-700/g' "$file"
    sed -i 's/text-blue-500/text-orange-500/g' "$file"
    sed -i 's/text-blue-600/text-orange-600/g' "$file"
    sed -i 's/ring-blue-500/ring-orange-500/g' "$file"
    sed -i 's/focus:ring-blue-500/focus:ring-orange-500/g' "$file"
    echo -e "${GREEN}  ✓ Updated blue classes in $(basename "$file")${NC}"
done

# =============================================================================
# 4c. Patch Switch.tsx - Replace blue checked state with orange
# =============================================================================
echo -e "${BLUE}[4c/5] Patching Switch component...${NC}"

SWITCH_TSX="$APP_DIR/packages/ui/src/components/Switch.tsx"

if [ -f "$SWITCH_TSX" ]; then
    # Replace blue checked state with orange
    # data-[state=checked]:bg-blue-500 -> data-[state=checked]:bg-orange-500
    sed -i 's/bg-blue-500/bg-orange-500/g' "$SWITCH_TSX"
    # focus-visible:outline-blue-500 -> focus-visible:outline-orange-500
    sed -i 's/outline-blue-500/outline-orange-500/g' "$SWITCH_TSX"
    echo -e "${GREEN}  ✓ Updated Switch colors (blue → orange)${NC}"
else
    echo -e "${YELLOW}  • Switch.tsx not found at expected location${NC}"
    # Try to find it elsewhere
    FOUND_SWITCH=$(find "$APP_DIR" -name "Switch.tsx" -path "*/ui/*" -type f 2>/dev/null | head -1)
    if [ -n "$FOUND_SWITCH" ]; then
        sed -i 's/bg-blue-500/bg-orange-500/g' "$FOUND_SWITCH"
        sed -i 's/outline-blue-500/outline-orange-500/g' "$FOUND_SWITCH"
        echo -e "${GREEN}  ✓ Found and updated Switch at: $FOUND_SWITCH${NC}"
    fi
fi

# =============================================================================
# 5. Replace absolute cap.so URLs with relative paths (for redirects)
# =============================================================================
echo -e "${BLUE}[5/6] Replacing absolute cap.so URLs with relative paths...${NC}"

# Replace https://cap.so/download with /download so the middleware redirect works
find "$APP_DIR" -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) 2>/dev/null | while read file; do
    if grep -q "https://cap.so/download" "$file" 2>/dev/null; then
        sed -i 's|https://cap.so/download|/download|g' "$file"
        echo -e "${GREEN}  ✓ Replaced cap.so/download in $(basename "$file")${NC}"
    fi
done

# Also replace any other cap.so URLs that should be relative
find "$APP_DIR" -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) 2>/dev/null | while read file; do
    if grep -q "https://cap.so/terms" "$file" 2>/dev/null; then
        sed -i 's|https://cap.so/terms|/terms|g' "$file"
        echo -e "${GREEN}  ✓ Replaced cap.so/terms in $(basename "$file")${NC}"
    fi
    if grep -q "https://cap.so/privacy" "$file" 2>/dev/null; then
        sed -i 's|https://cap.so/privacy|/privacy|g' "$file"
        echo -e "${GREEN}  ✓ Replaced cap.so/privacy in $(basename "$file")${NC}"
    fi
done

# =============================================================================
# 6. Update site config if exists
# =============================================================================
echo -e "${BLUE}[6/6] Patching additional config files...${NC}"

SITE_CONFIG="$APP_DIR/apps/web/config/site.ts"
if [ -f "$SITE_CONFIG" ]; then
    sed -i "s/name: \"Cap\"/name: \"${BRAND_APP_NAME}\"/g" "$SITE_CONFIG"
    sed -i "s/name: 'Cap'/name: '${BRAND_APP_NAME}'/g" "$SITE_CONFIG"
    echo -e "${GREEN}  ✓ Updated site config${NC}"
fi

# Update any constants file
CONSTANTS_FILE="$APP_DIR/apps/web/lib/constants.ts"
if [ -f "$CONSTANTS_FILE" ]; then
    sed -i "s/\"Cap\"/\"${BRAND_APP_NAME}\"/g" "$CONSTANTS_FILE"
    echo -e "${GREEN}  ✓ Updated constants${NC}"
fi

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
echo -e "  ${YELLOW}Primary${NC}:     ${BRAND_PRIMARY} / HSL(${BRAND_PRIMARY_HSL})"
echo ""
echo -e "URL replacements (for middleware redirects):"
echo -e "  ${YELLOW}cap.so/download${NC} → /download"
echo -e "  ${YELLOW}cap.so/terms${NC}    → /terms"
echo -e "  ${YELLOW}cap.so/privacy${NC}  → /privacy"
echo ""
echo -e "${YELLOW}Note:${NC} Logo SVG must be replaced manually in /branding/assets/"
echo ""
