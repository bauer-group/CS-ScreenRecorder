#!/bin/bash
###############################################################################
# Microsoft Entra ID (Azure AD) Authentication Patch
# Adds Microsoft as OAuth provider to Cap
#
# This patch modifies:
# - packages/database/auth/auth-options.ts (add Azure AD provider)
# - packages/utils/src/server-env.ts (add env vars)
# - apps/web/utils/public-env.tsx (add microsoftAuthAvailable flag)
# - apps/web/app/layout.tsx (pass flag to context)
# - apps/web/app/(org)/login/form.tsx (add Microsoft button)
# - apps/web/public/microsoft.svg (Microsoft logo)
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="${APP_DIR:-/src}"
PATCHES_DIR="${PATCHES_DIR:-/patches}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Microsoft Entra ID (Azure AD) Authentication${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# =============================================================================
# Helper function to patch files using node
# =============================================================================
patch_file() {
    local file="$1"
    local search="$2"
    local replace="$3"
    local description="$4"

    if [ ! -f "$file" ]; then
        echo -e "${YELLOW}  • File not found: $file${NC}"
        return 1
    fi

    if grep -qF "$search" "$file" 2>/dev/null; then
        # Use node for reliable multi-line replacement
        node -e "
const fs = require('fs');
const file = '$file';
const search = \`$search\`;
const replace = \`$replace\`;
let content = fs.readFileSync(file, 'utf8');
content = content.replace(search, replace);
fs.writeFileSync(file, content);
" 2>/dev/null && echo -e "${GREEN}  ✓ $description${NC}" || echo -e "${RED}  ✗ Failed: $description${NC}"
    else
        echo -e "${YELLOW}  • Already patched or pattern not found: $description${NC}"
    fi
}

# =============================================================================
# 1. Patch auth-options.ts - Add Azure AD Provider
# =============================================================================
echo -e "${BLUE}[1/6] Patching auth-options.ts...${NC}"

AUTH_FILE="$APP_DIR/packages/database/auth/auth-options.ts"

if [ -f "$AUTH_FILE" ]; then
    # Check if already patched
    if grep -q "AzureADProvider" "$AUTH_FILE"; then
        echo -e "${YELLOW}  • AzureADProvider already exists${NC}"
    else
        # Add import
        sed -i 's/import GoogleProvider from "next-auth\/providers\/google";/import GoogleProvider from "next-auth\/providers\/google";\nimport AzureADProvider from "next-auth\/providers\/azure-ad";/' "$AUTH_FILE"

        # Create the provider config to insert
        AZURE_PROVIDER='    AzureADProvider({\n      clientId: serverEnv().AZURE_AD_CLIENT_ID!,\n      clientSecret: serverEnv().AZURE_AD_CLIENT_SECRET!,\n      tenantId: serverEnv().AZURE_AD_TENANT_ID || "common",\n      authorization: {\n        params: {\n          scope: "openid email profile User.Read",\n        },\n      },\n      allowDangerousEmailAccountLinking: true,\n    }),'

        # Insert after GoogleProvider block - find the pattern and insert after
        # Using awk for multi-line insertion
        awk -v azure="$AZURE_PROVIDER" '
        /GoogleProvider\(\{/,/\}\),/ {
            print
            if (/\}\),/) {
                printf "%s\n", azure
            }
            next
        }
        {print}
        ' "$AUTH_FILE" > "$AUTH_FILE.tmp" && mv "$AUTH_FILE.tmp" "$AUTH_FILE"

        echo -e "${GREEN}  ✓ Added AzureADProvider to auth-options.ts${NC}"
    fi
else
    echo -e "${RED}  ✗ auth-options.ts not found${NC}"
fi

# =============================================================================
# 2. Patch server-env.ts - Add environment variables
# =============================================================================
echo -e "${BLUE}[2/6] Patching server-env.ts...${NC}"

SERVER_ENV="$APP_DIR/packages/utils/src/server-env.ts"

if [ -f "$SERVER_ENV" ]; then
    if grep -q "AZURE_AD_CLIENT_ID" "$SERVER_ENV"; then
        echo -e "${YELLOW}  • Azure AD env vars already exist${NC}"
    else
        # Add after GOOGLE_CLIENT_SECRET
        sed -i 's/GOOGLE_CLIENT_SECRET: z.string().optional(),/GOOGLE_CLIENT_SECRET: z.string().optional(),\n  AZURE_AD_CLIENT_ID: z.string().optional(),\n  AZURE_AD_CLIENT_SECRET: z.string().optional(),\n  AZURE_AD_TENANT_ID: z.string().optional(),/' "$SERVER_ENV"
        echo -e "${GREEN}  ✓ Added Azure AD environment variables${NC}"
    fi
else
    echo -e "${YELLOW}  • server-env.ts not found${NC}"
fi

# =============================================================================
# 3. Patch public-env.tsx - Add flag type
# =============================================================================
echo -e "${BLUE}[3/6] Patching public-env.tsx...${NC}"

PUBLIC_ENV="$APP_DIR/apps/web/utils/public-env.tsx"

if [ -f "$PUBLIC_ENV" ]; then
    if grep -q "microsoftAuthAvailable" "$PUBLIC_ENV"; then
        echo -e "${YELLOW}  • microsoftAuthAvailable already exists${NC}"
    else
        sed -i 's/googleAuthAvailable: boolean;/googleAuthAvailable: boolean;\n  microsoftAuthAvailable: boolean;/' "$PUBLIC_ENV"
        echo -e "${GREEN}  ✓ Added microsoftAuthAvailable type${NC}"
    fi
else
    echo -e "${YELLOW}  • public-env.tsx not found${NC}"
fi

# =============================================================================
# 4. Patch layout.tsx - Pass flag to provider
# =============================================================================
echo -e "${BLUE}[4/6] Patching layout.tsx...${NC}"

LAYOUT="$APP_DIR/apps/web/app/layout.tsx"

if [ -f "$LAYOUT" ]; then
    if grep -q "microsoftAuthAvailable" "$LAYOUT"; then
        echo -e "${YELLOW}  • microsoftAuthAvailable already in layout${NC}"
    else
        sed -i 's/googleAuthAvailable: !!serverEnv().GOOGLE_CLIENT_ID,/googleAuthAvailable: !!serverEnv().GOOGLE_CLIENT_ID,\n        microsoftAuthAvailable: !!serverEnv().AZURE_AD_CLIENT_ID,/' "$LAYOUT"
        echo -e "${GREEN}  ✓ Added microsoftAuthAvailable to layout context${NC}"
    fi
else
    echo -e "${YELLOW}  • layout.tsx not found${NC}"
fi

# =============================================================================
# 5. Patch login form - Add Microsoft button
# =============================================================================
echo -e "${BLUE}[5/6] Patching login form.tsx...${NC}"

LOGIN_FORM="$APP_DIR/apps/web/app/(org)/login/form.tsx"

if [ -f "$LOGIN_FORM" ]; then
    if grep -q "handleMicrosoftSignIn" "$LOGIN_FORM"; then
        echo -e "${YELLOW}  • Microsoft sign-in already exists${NC}"
    else
        # Add the handler function after handleGoogleSignIn
        # This is complex, so we'll use a heredoc with node
        node << 'NODESCRIPT'
const fs = require('fs');
const file = process.env.APP_DIR + '/apps/web/app/(org)/login/form.tsx';

if (!fs.existsSync(file)) {
    console.log('  • Login form not found');
    process.exit(0);
}

let content = fs.readFileSync(file, 'utf8');

// Add handler function
const handlerPattern = /const handleGoogleSignIn = \(\) => \{[\s\S]*?\n  \};/;
const handlerMatch = content.match(handlerPattern);

if (handlerMatch) {
    const microsoftHandler = `

  const handleMicrosoftSignIn = () => {
    setLoading(true);
    signIn("azure-ad", {
      callbackUrl: searchParams.get("callbackUrl") ?? "/dashboard",
    });
  };`;

    content = content.replace(handlerMatch[0], handlerMatch[0] + microsoftHandler);
}

// Add Microsoft button after Google button
const googleButtonPattern = /{publicEnv\.googleAuthAvailable && !oauthError && \([\s\S]*?Login with Google[\s\S]*?<\/MotionButton>\s*\)}/;
const buttonMatch = content.match(googleButtonPattern);

if (buttonMatch) {
    const microsoftButton = `
        {publicEnv.microsoftAuthAvailable && !oauthError && (
          <MotionButton
            variant="gray"
            onClick={handleMicrosoftSignIn}
            disabled={loading || emailSent}
          >
            <Image src="/microsoft.svg" alt="Microsoft" width={16} height={16} />
            Login with Microsoft
          </MotionButton>
        )}`;

    content = content.replace(buttonMatch[0], buttonMatch[0] + microsoftButton);
}

fs.writeFileSync(file, content);
console.log('  ✓ Added Microsoft sign-in button');
NODESCRIPT
    fi
else
    echo -e "${YELLOW}  • login form.tsx not found${NC}"
fi

# =============================================================================
# 6. Add Microsoft logo SVG
# =============================================================================
echo -e "${BLUE}[6/6] Adding Microsoft logo...${NC}"

PUBLIC_DIR="$APP_DIR/apps/web/public"

if [ -d "$PUBLIC_DIR" ]; then
    cat > "$PUBLIC_DIR/microsoft.svg" << 'SVGEOF'
<svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 21 21">
  <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
  <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
  <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
</svg>
SVGEOF
    echo -e "${GREEN}  ✓ Added microsoft.svg logo${NC}"
else
    echo -e "${YELLOW}  • public directory not found${NC}"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Microsoft Entra ID patch complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Required environment variables:"
echo -e "  ${YELLOW}AZURE_AD_CLIENT_ID${NC}     - Application (client) ID"
echo -e "  ${YELLOW}AZURE_AD_CLIENT_SECRET${NC} - Client secret value"
echo -e "  ${YELLOW}AZURE_AD_TENANT_ID${NC}     - Directory (tenant) ID (optional, defaults to 'common')"
echo ""
echo -e "Callback URL for Azure Portal:"
echo -e "  ${BLUE}https://your-domain.com/api/auth/callback/azure-ad${NC}"
echo ""
