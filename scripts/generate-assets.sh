#!/bin/bash
###############################################################################
# Generate Branding Assets from Source Logos
#
# Supports multiple input formats (in priority order):
# - EPS files: Best quality, converted to SVG and PNG automatically
# - SVG files: Used for web assets
# - PNG files: Used for bitmap assets (favicons, app icons, etc.)
#
# Supported source files in src/branding/:
#   logo-source-square.eps  - Square logo (EPS) - auto-converts to SVG+PNG
#   logo-source-square.svg  - Square logo for favicons
#   logo-source-square.png  - Square logo for bitmap icons (with transparency)
#   logo-source-wide.eps    - Wide logo (EPS) - auto-converts to SVG+PNG
#   logo-source-wide.svg    - Wide logo for headers
#   logo-source-wide.png    - Wide logo for bitmap assets (with transparency)
#
# Priority: EPS > SVG > PNG (EPS files are converted first if present)
# Transparency is preserved throughout all conversions.
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

# Check for ImageMagick
MAGICK_CMD=""
if command -v magick &> /dev/null; then
    MAGICK_CMD="magick"
elif command -v convert &> /dev/null; then
    MAGICK_CMD="convert"
else
    echo -e "${RED}Error: ImageMagick is not installed${NC}"
    echo ""
    echo "Install with:"
    echo "  Ubuntu/Debian: apt-get install imagemagick"
    echo "  macOS:         brew install imagemagick"
    echo "  Alpine:        apk add imagemagick"
    exit 1
fi
echo -e "${BLUE}Using ImageMagick: $MAGICK_CMD${NC}"

# Check for Ghostscript (required for EPS conversion)
GS_CMD=""
if command -v gs &> /dev/null; then
    GS_CMD="gs"
    echo -e "${BLUE}Using Ghostscript: $GS_CMD${NC}"
else
    echo -e "${YELLOW}Ghostscript not found - EPS conversion will be limited${NC}"
fi

# Check for pdf2svg (for high-quality PDF to SVG)
PDF2SVG_CMD=""
if command -v pdf2svg &> /dev/null; then
    PDF2SVG_CMD="pdf2svg"
    echo -e "${BLUE}Using pdf2svg: $PDF2SVG_CMD${NC}"
fi

# Create assets directory
mkdir -p "$ASSETS_DIR"

# =============================================================================
# EPS to SVG/PNG Conversion Functions
# Uses Ghostscript + pdf2svg (headless, no display required)
# =============================================================================

# Convert EPS to clean SVG using Ghostscript + pdf2svg
# Preserves vector quality and transparency
convert_eps_to_svg() {
    local eps_file="$1"
    local svg_file="$2"
    local temp_pdf="/tmp/eps_convert_$$.pdf"

    if [[ -z "$GS_CMD" ]]; then
        echo -e "  ${RED}Ghostscript required for EPS conversion${NC}"
        return 1
    fi

    echo -e "  Converting $(basename "$eps_file") to SVG..."

    # Step 1: EPS to PDF (Ghostscript preserves vectors perfectly)
    $GS_CMD -q -dNOPAUSE -dBATCH -dSAFER \
        -sDEVICE=pdfwrite \
        -dEPSCrop \
        -dPDFSETTINGS=/prepress \
        -sOutputFile="$temp_pdf" \
        "$eps_file" 2>/dev/null

    if [[ ! -f "$temp_pdf" ]]; then
        echo -e "  ${RED}Failed to convert EPS to PDF${NC}"
        return 1
    fi

    # Step 2: PDF to SVG
    if [[ -n "$PDF2SVG_CMD" ]]; then
        # pdf2svg preserves vectors
        $PDF2SVG_CMD "$temp_pdf" "$svg_file" 2>/dev/null
    else
        # Fallback: Use ImageMagick (may rasterize)
        echo -e "  ${YELLOW}Note: pdf2svg not found, using ImageMagick fallback${NC}"
        $MAGICK_CMD -density 300 "$temp_pdf" "$svg_file" 2>/dev/null
    fi

    rm -f "$temp_pdf"

    if [[ -f "$svg_file" ]]; then
        echo -e "  ${GREEN}Created: $(basename "$svg_file")${NC}"
        return 0
    else
        echo -e "  ${RED}Failed to create SVG${NC}"
        return 1
    fi
}

# Convert EPS to PNG using Ghostscript (4K resolution, transparent background)
# Default 1500 DPI produces ~4000px width from typical EPS files
convert_eps_to_png() {
    local eps_file="$1"
    local png_file="$2"
    local dpi="${3:-1500}"

    if [[ -z "$GS_CMD" ]]; then
        echo -e "  ${RED}Ghostscript required for EPS conversion${NC}"
        return 1
    fi

    echo -e "  Converting $(basename "$eps_file") to PNG (${dpi} DPI for 4K)..."

    # Use Ghostscript's pngalpha device for transparent background
    $GS_CMD -q -dNOPAUSE -dBATCH -dSAFER \
        -sDEVICE=pngalpha \
        -r"$dpi" \
        -dEPSCrop \
        -sOutputFile="$png_file" \
        "$eps_file" 2>/dev/null

    if [[ -f "$png_file" ]]; then
        # Get dimensions for info
        local dims=$($MAGICK_CMD identify -format "%wx%h" "$png_file" 2>/dev/null)
        echo -e "  ${GREEN}Created: $(basename "$png_file") (${dims})${NC}"
        return 0
    else
        echo -e "  ${RED}Failed to create PNG${NC}"
        return 1
    fi
}

# Convert SVG to PNG using ImageMagick (4K resolution, preserves transparency)
convert_svg_to_png() {
    local svg_file="$1"
    local png_file="$2"
    local density="${3:-1500}"

    echo -e "  Converting $(basename "$svg_file") to PNG (density ${density} for 4K)..."

    # Use high density for 4K quality, transparent background
    $MAGICK_CMD -background none -density "$density" "$svg_file" "PNG32:$png_file"

    if [[ -f "$png_file" ]]; then
        local dims=$($MAGICK_CMD identify -format "%wx%h" "$png_file" 2>/dev/null)
        echo -e "  ${GREEN}Created: $(basename "$png_file") (${dims})${NC}"
        return 0
    else
        echo -e "  ${RED}Failed to create PNG${NC}"
        return 1
    fi
}

# =============================================================================
# Source File Detection and Conversion
# Priority: EPS > SVG > PNG
# =============================================================================

# Source file variables
EPS_SQUARE=""
EPS_WIDE=""
SVG_SQUARE=""
SVG_WIDE=""
PNG_SQUARE=""
PNG_WIDE=""

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN} Checking Source Files${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# -----------------------------------------------------------------------------
# Detect and Process Square Logo
# -----------------------------------------------------------------------------
echo -e "${BLUE}Square logo (for icons):${NC}"

# Check for EPS first (highest priority)
if [[ -f "$BRANDING_DIR/logo-source-square.eps" ]]; then
    EPS_SQUARE="$BRANDING_DIR/logo-source-square.eps"
    echo -e "  EPS: ${GREEN}Found${NC}"

    # Convert EPS to SVG if SVG doesn't exist or EPS is newer
    if [[ ! -f "$BRANDING_DIR/logo-source-square.svg" ]] || \
       [[ "$EPS_SQUARE" -nt "$BRANDING_DIR/logo-source-square.svg" ]]; then
        convert_eps_to_svg "$EPS_SQUARE" "$BRANDING_DIR/logo-source-square.svg"
    fi

    # Convert EPS to PNG if PNG doesn't exist or EPS is newer
    if [[ ! -f "$BRANDING_DIR/logo-source-square.png" ]] || \
       [[ "$EPS_SQUARE" -nt "$BRANDING_DIR/logo-source-square.png" ]]; then
        convert_eps_to_png "$EPS_SQUARE" "$BRANDING_DIR/logo-source-square.png"
    fi
fi

# Check for SVG
if [[ -f "$BRANDING_DIR/logo-source-square.svg" ]]; then
    SVG_SQUARE="$BRANDING_DIR/logo-source-square.svg"
    echo -e "  SVG: ${GREEN}Found${NC}"

    # Convert SVG to PNG if PNG doesn't exist
    if [[ ! -f "$BRANDING_DIR/logo-source-square.png" ]]; then
        convert_svg_to_png "$SVG_SQUARE" "$BRANDING_DIR/logo-source-square.png"
    fi
else
    echo -e "  SVG: ${YELLOW}Not found${NC}"
fi

# Check for PNG
if [[ -f "$BRANDING_DIR/logo-source-square.png" ]]; then
    PNG_SQUARE="$BRANDING_DIR/logo-source-square.png"
    echo -e "  PNG: ${GREEN}Found${NC}"
else
    echo -e "  PNG: ${YELLOW}Not found${NC}"
fi

# -----------------------------------------------------------------------------
# Detect and Process Wide Logo
# -----------------------------------------------------------------------------
echo ""
echo -e "${BLUE}Wide logo (for headers/emails):${NC}"

# Check for EPS first (highest priority)
if [[ -f "$BRANDING_DIR/logo-source-wide.eps" ]]; then
    EPS_WIDE="$BRANDING_DIR/logo-source-wide.eps"
    echo -e "  EPS: ${GREEN}Found${NC}"

    # Convert EPS to SVG if SVG doesn't exist or EPS is newer
    if [[ ! -f "$BRANDING_DIR/logo-source-wide.svg" ]] || \
       [[ "$EPS_WIDE" -nt "$BRANDING_DIR/logo-source-wide.svg" ]]; then
        convert_eps_to_svg "$EPS_WIDE" "$BRANDING_DIR/logo-source-wide.svg"
    fi

    # Convert EPS to PNG if PNG doesn't exist or EPS is newer
    if [[ ! -f "$BRANDING_DIR/logo-source-wide.png" ]] || \
       [[ "$EPS_WIDE" -nt "$BRANDING_DIR/logo-source-wide.png" ]]; then
        convert_eps_to_png "$EPS_WIDE" "$BRANDING_DIR/logo-source-wide.png"
    fi
fi

# Check for SVG
if [[ -f "$BRANDING_DIR/logo-source-wide.svg" ]]; then
    SVG_WIDE="$BRANDING_DIR/logo-source-wide.svg"
    echo -e "  SVG: ${GREEN}Found${NC}"

    # Convert SVG to PNG if PNG doesn't exist
    if [[ ! -f "$BRANDING_DIR/logo-source-wide.png" ]]; then
        convert_svg_to_png "$SVG_WIDE" "$BRANDING_DIR/logo-source-wide.png"
    fi
else
    echo -e "  SVG: ${YELLOW}Not found${NC}"
fi

# Check for PNG
if [[ -f "$BRANDING_DIR/logo-source-wide.png" ]]; then
    PNG_WIDE="$BRANDING_DIR/logo-source-wide.png"
    echo -e "  PNG: ${GREEN}Found${NC}"
else
    echo -e "  PNG: ${YELLOW}Not found${NC}"
fi

# -----------------------------------------------------------------------------
# Validate we have at least PNG files for asset generation
# -----------------------------------------------------------------------------
echo ""
if [[ -z "$PNG_SQUARE" ]] && [[ -z "$PNG_WIDE" ]]; then
    echo -e "${RED}Error: No source files available.${NC}"
    echo ""
    echo "Please provide at least one of:"
    echo "  $BRANDING_DIR/logo-source-square.eps (or .svg or .png)"
    echo "  $BRANDING_DIR/logo-source-wide.eps (or .svg or .png)"
    echo ""
    exit 1
fi

# Use square for wide if wide is missing (and vice versa)
if [[ -z "$PNG_WIDE" ]] && [[ -n "$PNG_SQUARE" ]]; then
    echo -e "${YELLOW}Note: Using square PNG for wide assets${NC}"
    PNG_WIDE="$PNG_SQUARE"
fi
if [[ -z "$PNG_SQUARE" ]] && [[ -n "$PNG_WIDE" ]]; then
    echo -e "${YELLOW}Note: Using wide PNG for square assets${NC}"
    PNG_SQUARE="$PNG_WIDE"
fi

# Get background color from branding.env
BG_COLOR="#FFFFFF"
if [[ -f "$BRANDING_DIR/branding.env" ]]; then
    source "$BRANDING_DIR/branding.env" 2>/dev/null || true
    BG_COLOR="${BRAND_BACKGROUND_COLOR:-#FFFFFF}"
fi

# =============================================================================
# Asset Generation Functions
# Uses PNG sources - preserves original transparency
# =============================================================================

# Generate square icon from PNG (preserves transparency)
generate_icon() {
    local size=$1
    local output=$2
    local background=${3:-transparent}
    local source_file="$PNG_SQUARE"

    if [[ "$background" == "transparent" ]]; then
        # Just resize, preserve original transparency 1:1
        $MAGICK_CMD "$source_file" \
            -resize "${size}x${size}" \
            "PNG32:$output"
    else
        # With background color (for app icons that need solid background)
        $MAGICK_CMD "$source_file" \
            -resize "${size}x${size}" \
            -background "$background" \
            -gravity center \
            -extent "${size}x${size}" \
            -flatten \
            "$output"
    fi
    echo "  Created: $(basename "$output") (${size}x${size})"
}

# Generate wide logo from PNG (preserves transparency)
generate_logo() {
    local width=$1
    local height=$2
    local output=$3
    local source_file="$PNG_WIDE"

    # Just resize, preserve original transparency 1:1
    $MAGICK_CMD "$source_file" \
        -resize "${width}x${height}" \
        "PNG32:$output"
    echo "  Created: $(basename "$output") (${width}x${height})"
}

# =============================================================================
# Generate Assets for Cap
# =============================================================================

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN} Generating Bitmap Assets${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Generate main logo for emails and header (transparent)
echo "Generating logos (transparent background)..."
generate_logo 200 50 "$ASSETS_DIR/logo.png"
generate_logo 400 100 "$ASSETS_DIR/logo@2x.png"

# Generate favicons (transparent)
echo ""
echo "Generating favicons (transparent)..."
generate_icon 16 "$ASSETS_DIR/favicon-16x16.png"
generate_icon 32 "$ASSETS_DIR/favicon-32x32.png"
generate_icon 48 "$ASSETS_DIR/favicon-48x48.png"

# Create multi-size ICO file
$MAGICK_CMD "$ASSETS_DIR/favicon-16x16.png" \
        "$ASSETS_DIR/favicon-32x32.png" \
        "$ASSETS_DIR/favicon-48x48.png" \
        "$ASSETS_DIR/favicon.ico"
echo "  Created: favicon.ico (multi-size)"

# Generate Apple touch icon (needs solid background for iOS)
echo ""
echo "Generating Apple icons (with background: $BG_COLOR)..."
generate_icon 180 "$ASSETS_DIR/apple-touch-icon.png" "$BG_COLOR"

# Generate Android Chrome icons (needs solid background)
echo ""
echo "Generating Android icons (with background: $BG_COLOR)..."
generate_icon 192 "$ASSETS_DIR/android-chrome-192x192.png" "$BG_COLOR"
generate_icon 512 "$ASSETS_DIR/android-chrome-512x512.png" "$BG_COLOR"

# Generate OpenGraph image (social media preview)
echo ""
echo "Generating OpenGraph image..."
$MAGICK_CMD "$PNG_WIDE" \
    -resize "600x315" \
    -background "$BG_COLOR" \
    -gravity center \
    -extent "1200x630" \
    -flatten \
    "$ASSETS_DIR/opengraph-image.jpg"
echo "  Created: opengraph-image.jpg (1200x630)"

# Generate maskable icon for PWA
echo ""
echo "Generating PWA maskable icon..."
$MAGICK_CMD "$PNG_SQUARE" \
    -resize "384x384" \
    -background "$BG_COLOR" \
    -gravity center \
    -extent "512x512" \
    -flatten \
    "$ASSETS_DIR/maskable-icon-512x512.png"
echo "  Created: maskable-icon-512x512.png (512x512)"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Asset Generation Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Source files:"
if [[ -n "$EPS_SQUARE" ]]; then
    echo -e "  EPS Square: ${BLUE}$EPS_SQUARE${NC}"
fi
if [[ -n "$EPS_WIDE" ]]; then
    echo -e "  EPS Wide:   ${BLUE}$EPS_WIDE${NC}"
fi
if [[ -n "$SVG_SQUARE" ]]; then
    echo -e "  SVG Square: ${BLUE}$SVG_SQUARE${NC}"
fi
if [[ -n "$SVG_WIDE" ]]; then
    echo -e "  SVG Wide:   ${BLUE}$SVG_WIDE${NC}"
fi
echo -e "  PNG Square: ${BLUE}$PNG_SQUARE${NC}"
echo -e "  PNG Wide:   ${BLUE}$PNG_WIDE${NC}"
echo ""
echo "Generated bitmap assets in $ASSETS_DIR:"
ls -la "$ASSETS_DIR"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review generated assets"
echo "  2. Build white-label image:"
echo "     docker compose -f docker-compose.development.yml up -d --build"
echo ""
echo -e "${BLUE}Cap Branding Notes:${NC}"
echo "  - Favicon and logo are applied during Docker image build"
echo "  - Assets are copied to Cap's public directories in the image"
echo ""
echo -e "${GREEN}========================================${NC}"
