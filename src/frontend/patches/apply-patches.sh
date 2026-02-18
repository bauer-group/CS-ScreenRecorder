#!/bin/bash
###############################################################################
# Apply Code Patches to Cap Source
# This script applies custom code patches during Docker build
#
# Patches are applied AFTER the base image but BEFORE branding.
#
# Patch Types (in order of application):
#   - *.patch  : Standard unified diff patches (applied with 'patch' command)
#   - *.sh     : Shell scripts for complex text-based modifications
#   - *.ast/   : AST-based patches using ts-morph (robust across versions)
#
# Naming Convention:
#   NNN-description.patch  (e.g., 001-fix-typo.patch)
#   NNN-description.sh     (e.g., 002-custom-feature.sh)
#   NNN-description.ast/   (e.g., 003-microsoft-auth.ast/)
#
# AST Patch Structure:
#   NNN-description.ast/
#     package.json   - Must include ts-morph dependency
#     index.mjs      - Main patch script (ES module)
#
# Patches are applied in alphabetical order by name.
###############################################################################

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Directories
PATCHES_DIR="${PATCHES_DIR:-/patches}"
APP_DIR="${APP_DIR:-/app}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Applying Code Patches${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${BLUE}Patches directory: $PATCHES_DIR${NC}"
echo -e "${BLUE}App directory: $APP_DIR${NC}"
echo ""

# Check if patches directory exists
if [ ! -d "$PATCHES_DIR" ]; then
    echo -e "${YELLOW}No patches directory found, skipping...${NC}"
    exit 0
fi

# Build list of all patches (files and directories)
# We collect them all, then sort by name to ensure correct order
PATCH_LIST=""

# Collect .patch files
for f in "$PATCHES_DIR"/[0-9]*.patch; do
    [ -f "$f" ] && PATCH_LIST="$PATCH_LIST $f"
done

# Collect .sh files (exclude apply-patches.sh)
for f in "$PATCHES_DIR"/[0-9]*.sh; do
    if [ -f "$f" ] && [ "$(basename "$f")" != "apply-patches.sh" ]; then
        PATCH_LIST="$PATCH_LIST $f"
    fi
done

# Collect .ast directories
for d in "$PATCHES_DIR"/[0-9]*.ast; do
    [ -d "$d" ] && PATCH_LIST="$PATCH_LIST $d"
done

# Sort by basename to ensure correct order (001-, 002-, etc.)
# This handles the case where patches might be in different subdirectories
PATCH_LIST=$(echo "$PATCH_LIST" | xargs -n1 | while read p; do
    echo "$(basename "$p") $p"
done | sort | cut -d' ' -f2- | xargs)

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
echo ""

# Process each patch
APPLIED=0
FAILED=0

for patch_item in $PATCH_LIST; do
    name=$(basename "$patch_item")

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    SUCCESS=0

    # Determine patch type and apply
    if [ -f "$patch_item" ]; then
        # File-based patch (.patch or .sh)
        case "$name" in
            *.patch)
                echo -e "${BLUE}[DIFF] Applying: $name${NC}"
                echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                if patch -p1 -d "$APP_DIR" < "$patch_item" 2>&1; then
                    SUCCESS=1
                fi
                ;;
            *.sh)
                echo -e "${BLUE}[SHELL] Applying: $name${NC}"
                echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                chmod +x "$patch_item"
                export APP_DIR PATCHES_DIR
                if /bin/bash "$patch_item" 2>&1; then
                    SUCCESS=1
                fi
                ;;
            *)
                echo -e "${YELLOW}[?] Unknown file type: $name${NC}"
                ;;
        esac

    elif [ -d "$patch_item" ]; then
        # Directory-based patch (.ast)
        case "$name" in
            *.ast)
                echo -e "${CYAN}[AST] Applying: $name${NC}"
                echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

                # Validate AST patch structure
                if [ ! -f "$patch_item/package.json" ]; then
                    echo -e "${RED}  Missing package.json in $name${NC}"
                elif [ ! -f "$patch_item/index.mjs" ]; then
                    echo -e "${RED}  Missing index.mjs in $name${NC}"
                else
                    # Install dependencies and run patch
                    (
                        cd "$patch_item" || exit 1

                        echo -e "${BLUE}  Installing dependencies...${NC}"
                        if npm install --silent 2>/dev/null || npm install; then
                            echo ""
                            echo -e "${BLUE}  Running AST patcher...${NC}"
                            echo ""
                            if APP_DIR="$APP_DIR" node index.mjs; then
                                exit 0
                            else
                                exit 1
                            fi
                        else
                            echo -e "${RED}  npm install failed${NC}"
                            exit 1
                        fi
                    )
                    [ $? -eq 0 ] && SUCCESS=1
                fi
                ;;
            *)
                echo -e "${YELLOW}[?] Unknown directory type: $name${NC}"
                ;;
        esac
    fi

    # Report result
    if [ "$SUCCESS" -eq 1 ]; then
        echo -e "${GREEN}✓ Successfully applied: $name${NC}"
        APPLIED=$((APPLIED + 1))
    else
        echo -e "${RED}✗ Failed to apply: $name${NC}"
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
echo -e "  Patch types supported:"
echo -e "    ${BLUE}*.patch${NC} - Unified diff patches"
echo -e "    ${BLUE}*.sh${NC}    - Shell script patches"
echo -e "    ${CYAN}*.ast/${NC}  - AST-based patches (ts-morph)"
echo ""

# Exit with error if any patches failed
if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}BUILD ABORTED: Some patches failed to apply!${NC}"
    exit 1
fi

echo -e "${GREEN}All patches applied successfully!${NC}"
exit 0
