#!/bin/bash
###############################################################################
# Apply Code Patches to Cap Source
# This script applies custom code patches during Docker build
#
# Patches are applied AFTER the base image but BEFORE branding.
# Each patch is a .patch file or a .sh script in the patches/ directory.
#
# Patch Types:
#   - *.patch  : Standard unified diff patches (applied with 'patch' command)
#   - *.sh     : Shell scripts for complex modifications
#
# Naming Convention:
#   NNN-description.patch  (e.g., 001-custom-title.patch)
#   NNN-description.sh     (e.g., 002-custom-feature.sh)
#
# Patches are applied in alphabetical order by filename.
#
# NOTE: Currently no patches are required for Cap.
#       This script is here for future customization needs.
###############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Directories
PATCHES_DIR="${PATCHES_DIR:-/patches}"
APP_DIR="${APP_DIR:-/app}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Applying Code Patches${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if patches directory exists
if [ ! -d "$PATCHES_DIR" ]; then
    echo -e "${YELLOW}No patches directory found, skipping...${NC}"
    exit 0
fi

# Build list of patch files (exclude this script itself)
PATCH_LIST=""
for f in "$PATCHES_DIR"/*.patch "$PATCHES_DIR"/[0-9]*.sh; do
    if [ -f "$f" ] && [ "$(basename "$f")" != "apply-patches.sh" ]; then
        PATCH_LIST="$PATCH_LIST $f"
    fi
done

# Trim leading space and count
PATCH_LIST=$(echo "$PATCH_LIST" | xargs)
if [ -z "$PATCH_LIST" ]; then
    echo -e "${YELLOW}No patches found in $PATCHES_DIR, skipping...${NC}"
    exit 0
fi

# Count patches
PATCH_COUNT=0
for f in $PATCH_LIST; do
    PATCH_COUNT=$((PATCH_COUNT + 1))
done

echo -e "${BLUE}Found $PATCH_COUNT patch(es) to apply${NC}"
echo -e "${BLUE}App directory: $APP_DIR${NC}"
echo ""

# Process each patch
APPLIED=0
FAILED=0

for patch_file in $PATCH_LIST; do
    filename=$(basename "$patch_file")

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}Applying: $filename${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    SUCCESS=0

    case "$filename" in
        *.patch)
            # Apply unified diff patch
            if patch -p1 -d "$APP_DIR" < "$patch_file" 2>&1; then
                SUCCESS=1
            fi
            ;;
        *.sh)
            # Execute shell script patch
            chmod +x "$patch_file"
            export APP_DIR
            if /bin/bash "$patch_file" 2>&1; then
                SUCCESS=1
            fi
            ;;
        *)
            echo -e "${YELLOW}  Unknown patch type: $filename${NC}"
            ;;
    esac

    if [ "$SUCCESS" -eq 1 ]; then
        echo -e "${GREEN}✓ Successfully applied: $filename${NC}"
        APPLIED=$((APPLIED + 1))
    else
        echo -e "${RED}✗ Failed to apply: $filename${NC}"
        FAILED=$((FAILED + 1))
    fi

    echo ""
done

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Patch Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "  Total:   $PATCH_COUNT"
echo -e "  Applied: ${GREEN}$APPLIED${NC}"
echo -e "  Failed:  ${RED}$FAILED${NC}"
echo ""

# Exit with error if any patches failed
if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}BUILD ABORTED: Some patches failed to apply!${NC}"
    exit 1
fi

echo -e "${GREEN}All patches applied successfully!${NC}"
exit 0
