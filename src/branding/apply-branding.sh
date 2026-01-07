#!/bin/bash
###############################################################################
# Apply White-Label Branding to Cap Screen Recorder
# This script applies custom branding during Docker build
#
# Compatible with: Cap (Next.js frontend)
# Repository: https://github.com/CapSoftware/Cap
#
# Cap Branding:
# - Logo and favicon files in /app/apps/web/public/
# - Assets are statically compiled into the Next.js build
#
# Expected assets in /branding/assets/:
#   - favicon.ico
#   - favicon-16x16.png
#   - favicon-32x32.png
#   - cap-logo.png
#   - apple-touch-icon.png
#   - android-chrome-192x192.png
#   - android-chrome-512x512.png
#   - og.png (OpenGraph image)
###############################################################################

set -eu

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Applying BAUER GROUP Branding to Cap${NC}"
echo -e "${GREEN}========================================${NC}"

# Configuration
BRANDING_DIR="${BRANDING_DIR:-/branding}"
ASSETS_DIR="$BRANDING_DIR/assets"

# Find Cap's public directory
PUBLIC_DIR=""
for dir in /app/apps/web/public /app/public; do
    if [ -d "$dir" ]; then
        PUBLIC_DIR="$dir"
        break
    fi
done

if [ -z "$PUBLIC_DIR" ]; then
    echo -e "${RED}Error: Could not find Cap public directory${NC}"
    echo "Searched: /app/apps/web/public, /app/public"
    exit 1
fi

echo -e "${BLUE}Public directory: $PUBLIC_DIR${NC}"
echo -e "${BLUE}Branding assets: $ASSETS_DIR${NC}"
echo ""

# =============================================================================
# Check for branding assets
# =============================================================================

if [ ! -d "$ASSETS_DIR" ]; then
    echo -e "${YELLOW}No branding assets directory found at $ASSETS_DIR${NC}"
    echo -e "${YELLOW}Skipping branding...${NC}"
    exit 0
fi

# =============================================================================
# Apply branding assets
# =============================================================================

echo -e "${BLUE}[1/2] Copying branding assets...${NC}"

COPIED=0

# Favicon files
for file in favicon.ico favicon-16x16.png favicon-32x32.png; do
    if [ -f "$ASSETS_DIR/$file" ]; then
        cp "$ASSETS_DIR/$file" "$PUBLIC_DIR/$file"
        echo "  Applied: $file"
        COPIED=$((COPIED + 1))
    fi
done

# Cap logo
if [ -f "$ASSETS_DIR/cap-logo.png" ]; then
    cp "$ASSETS_DIR/cap-logo.png" "$PUBLIC_DIR/cap-logo.png"
    echo "  Applied: cap-logo.png"
    COPIED=$((COPIED + 1))
fi

# Apple/Android icons
for file in apple-touch-icon.png android-chrome-192x192.png android-chrome-512x512.png; do
    if [ -f "$ASSETS_DIR/$file" ]; then
        cp "$ASSETS_DIR/$file" "$PUBLIC_DIR/$file"
        echo "  Applied: $file"
        COPIED=$((COPIED + 1))
    fi
done

# OpenGraph image
if [ -f "$ASSETS_DIR/og.png" ]; then
    cp "$ASSETS_DIR/og.png" "$PUBLIC_DIR/og.png"
    echo "  Applied: og.png"
    COPIED=$((COPIED + 1))
fi

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${BLUE}[2/2] Summary${NC}"
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN} Branding Applied Successfully${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Assets copied: ${GREEN}$COPIED${NC}"
echo -e "  Target directory: $PUBLIC_DIR"
echo ""

if [ $COPIED -eq 0 ]; then
    echo -e "${YELLOW}Warning: No assets were copied!${NC}"
    echo "Make sure to run ./scripts/generate-assets.sh first."
fi

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
