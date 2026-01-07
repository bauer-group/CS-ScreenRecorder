#!/bin/bash
###############################################################################
# Generate Branding Assets for Cap Screen Recorder
#
# This script generates assets specifically for Cap's expected file structure.
#
# Cap expects these files in /apps/web/public/:
#   - favicon.ico
#   - favicon-16x16.png
#   - favicon-32x32.png
#   - cap-logo.png
#   - apple-touch-icon.png
#   - android-chrome-192x192.png
#   - android-chrome-512x512.png
#   - og.png (OpenGraph image 1200x630)
#
# Source files in src/branding/:
#   logo-source-square.{eps,svg,png} - Square logo for icons/favicon
#   logo-source-wide.{eps,svg,png}   - Wide logo for headers
###############################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(dirname "$0")"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BRANDING_DIR="$PROJECT_DIR/src/branding"
ASSETS_DIR="$BRANDING_DIR/assets"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Cap Branding Asset Generator${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# =============================================================================
# Tool Detection
# =============================================================================

MAGICK_CMD=""
if command -v magick &> /dev/null; then
    MAGICK_CMD="magick"
elif command -v convert &> /dev/null; then
    MAGICK_CMD="convert"
else
    echo -e "${RED}Error: ImageMagick is not installed${NC}"
    exit 1
fi
echo -e "${BLUE}Using ImageMagick: $MAGICK_CMD${NC}"

# Check for Ghostscript (for EPS)
GS_CMD=""
if command -v gs &> /dev/null; then
    GS_CMD="gs"
    echo -e "${BLUE}Using Ghostscript: $GS_CMD${NC}"
fi

# Create assets directory
mkdir -p "$ASSETS_DIR"

# =============================================================================
# EPS to PNG Conversion
# =============================================================================

convert_eps_to_png() {
    local eps_file="$1"
    local png_file="$2"
    local dpi="${3:-1500}"

    if [[ -z "$GS_CMD" ]]; then
        echo -e "  ${RED}Ghostscript required for EPS conversion${NC}"
        return 1
    fi

    $GS_CMD -q -dNOPAUSE -dBATCH -dSAFER \
        -sDEVICE=pngalpha \
        -r"$dpi" \
        -dEPSCrop \
        -sOutputFile="$png_file" \
        "$eps_file" 2>/dev/null

    if [[ -f "$png_file" ]]; then
        return 0
    else
        return 1
    fi
}

# =============================================================================
# Source File Detection
# =============================================================================

PNG_SQUARE=""
PNG_WIDE=""

echo -e "${CYAN}Checking source files...${NC}"

# Square logo
if [[ -f "$BRANDING_DIR/logo-source-square.eps" ]] && [[ -n "$GS_CMD" ]]; then
    if [[ ! -f "$BRANDING_DIR/logo-source-square.png" ]]; then
        echo "  Converting square EPS to PNG..."
        convert_eps_to_png "$BRANDING_DIR/logo-source-square.eps" "$BRANDING_DIR/logo-source-square.png"
    fi
fi

if [[ -f "$BRANDING_DIR/logo-source-square.png" ]]; then
    PNG_SQUARE="$BRANDING_DIR/logo-source-square.png"
    echo -e "  Square logo: ${GREEN}Found${NC}"
else
    echo -e "  Square logo: ${RED}Not found${NC}"
fi

# Wide logo
if [[ -f "$BRANDING_DIR/logo-source-wide.eps" ]] && [[ -n "$GS_CMD" ]]; then
    if [[ ! -f "$BRANDING_DIR/logo-source-wide.png" ]]; then
        echo "  Converting wide EPS to PNG..."
        convert_eps_to_png "$BRANDING_DIR/logo-source-wide.eps" "$BRANDING_DIR/logo-source-wide.png"
    fi
fi

if [[ -f "$BRANDING_DIR/logo-source-wide.png" ]]; then
    PNG_WIDE="$BRANDING_DIR/logo-source-wide.png"
    echo -e "  Wide logo: ${GREEN}Found${NC}"
else
    echo -e "  Wide logo: ${YELLOW}Not found (using square)${NC}"
    PNG_WIDE="$PNG_SQUARE"
fi

if [[ -z "$PNG_SQUARE" ]]; then
    echo -e "${RED}Error: No source logo found!${NC}"
    echo "Please provide: src/branding/logo-source-square.png"
    exit 1
fi

# Background color
BG_COLOR="#FFFFFF"
if [[ -f "$BRANDING_DIR/branding.env" ]]; then
    source "$BRANDING_DIR/branding.env" 2>/dev/null || true
    BG_COLOR="${BRAND_BACKGROUND_COLOR:-#FFFFFF}"
fi

# =============================================================================
# Generate Cap-specific Assets
# =============================================================================

echo ""
echo -e "${CYAN}Generating Cap assets...${NC}"
echo ""

# Favicons (transparent)
echo "Generating favicons..."
$MAGICK_CMD "$PNG_SQUARE" -resize 16x16 "PNG32:$ASSETS_DIR/favicon-16x16.png"
echo "  Created: favicon-16x16.png"

$MAGICK_CMD "$PNG_SQUARE" -resize 32x32 "PNG32:$ASSETS_DIR/favicon-32x32.png"
echo "  Created: favicon-32x32.png"

$MAGICK_CMD "$ASSETS_DIR/favicon-16x16.png" "$ASSETS_DIR/favicon-32x32.png" "$ASSETS_DIR/favicon.ico"
echo "  Created: favicon.ico"

# Cap logo (this is what Cap uses in the UI)
echo ""
echo "Generating cap-logo.png..."
$MAGICK_CMD "$PNG_WIDE" -resize 200x50 "PNG32:$ASSETS_DIR/cap-logo.png"
echo "  Created: cap-logo.png"

# Apple touch icon (180x180, solid background)
echo ""
echo "Generating Apple touch icon..."
$MAGICK_CMD "$PNG_SQUARE" \
    -resize 180x180 \
    -background "$BG_COLOR" \
    -gravity center \
    -extent 180x180 \
    -flatten \
    "$ASSETS_DIR/apple-touch-icon.png"
echo "  Created: apple-touch-icon.png"

# Android Chrome icons (solid background)
echo ""
echo "Generating Android icons..."
$MAGICK_CMD "$PNG_SQUARE" \
    -resize 192x192 \
    -background "$BG_COLOR" \
    -gravity center \
    -extent 192x192 \
    -flatten \
    "$ASSETS_DIR/android-chrome-192x192.png"
echo "  Created: android-chrome-192x192.png"

$MAGICK_CMD "$PNG_SQUARE" \
    -resize 512x512 \
    -background "$BG_COLOR" \
    -gravity center \
    -extent 512x512 \
    -flatten \
    "$ASSETS_DIR/android-chrome-512x512.png"
echo "  Created: android-chrome-512x512.png"

# OpenGraph image (1200x630)
echo ""
echo "Generating OpenGraph image (og.png)..."
$MAGICK_CMD "$PNG_WIDE" \
    -resize 600x315 \
    -background "$BG_COLOR" \
    -gravity center \
    -extent 1200x630 \
    -flatten \
    "$ASSETS_DIR/og.png"
echo "  Created: og.png (1200x630)"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Asset Generation Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Generated assets for Cap:"
ls -la "$ASSETS_DIR"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Rebuild Docker image:"
echo "     docker compose -f docker-compose.development.yml build"
echo ""
