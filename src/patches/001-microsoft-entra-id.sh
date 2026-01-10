#!/bin/bash
###############################################################################
# Microsoft Entra ID (Azure AD) Authentication Patch
# Adds Microsoft as OAuth provider to Cap
#
# This patch modifies:
# - packages/database/auth/auth-options.ts (add Azure AD provider)
# - packages/env/server.ts (add env vars)
# - apps/web/utils/public-env.tsx (add microsoftAuthAvailable flag)
# - apps/web/app/layout.tsx (pass flag to context)
# - apps/web/app/(org)/login/form.tsx (add Microsoft button)
# - apps/web/public/microsoft.svg (Microsoft logo)
#
# Compatible with Cap v0.4.x
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="${APP_DIR:-/app}"
PATCHES_DIR="${PATCHES_DIR:-/patches}"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Microsoft Entra ID (Azure AD) Authentication${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# =============================================================================
# 1. Patch auth-options.ts - Add Azure AD Provider
# =============================================================================
echo -e "${BLUE}[1/6] Patching auth-options.ts...${NC}"

AUTH_FILE="$APP_DIR/packages/database/auth/auth-options.ts"

if [ -f "$AUTH_FILE" ]; then
    if grep -q "AzureADProvider" "$AUTH_FILE"; then
        echo -e "${YELLOW}  • AzureADProvider already exists${NC}"
    else
        node << 'NODESCRIPT'
const fs = require('fs');
const file = process.env.APP_DIR + '/packages/database/auth/auth-options.ts';

if (!fs.existsSync(file)) {
    console.log('  ✗ auth-options.ts not found');
    process.exit(1);
}

let content = fs.readFileSync(file, 'utf8');

// Add import for AzureADProvider after GoogleProvider import
const googleImport = 'import GoogleProvider from "next-auth/providers/google";';
const azureImport = 'import AzureADProvider from "next-auth/providers/azure-ad";';

if (content.includes(googleImport) && !content.includes(azureImport)) {
    content = content.replace(
        googleImport,
        googleImport + '\n' + azureImport
    );
    console.log('  ✓ Added AzureADProvider import');
}

// Add AzureADProvider configuration after GoogleProvider
// Find GoogleProvider block and insert AzureADProvider after it
const googleProviderRegex = /GoogleProvider\(\{[\s\S]*?\}\),/;
const googleMatch = content.match(googleProviderRegex);

if (googleMatch && !content.includes('AzureADProvider({')) {
    const azureProvider = `
    AzureADProvider({
      clientId: serverEnv().AZURE_AD_CLIENT_ID!,
      clientSecret: serverEnv().AZURE_AD_CLIENT_SECRET!,
      tenantId: serverEnv().AZURE_AD_TENANT_ID || "common",
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "select_account",
        },
      },
    }),`;

    content = content.replace(googleMatch[0], googleMatch[0] + azureProvider);
    console.log('  ✓ Added AzureADProvider configuration');
}

fs.writeFileSync(file, content);
console.log('  ✓ auth-options.ts patched');
NODESCRIPT
    fi
else
    echo -e "${RED}  ✗ auth-options.ts not found${NC}"
fi

# =============================================================================
# 2. Patch packages/env/server.ts - Add environment variables
# =============================================================================
echo -e "${BLUE}[2/6] Patching packages/env/server.ts...${NC}"

SERVER_ENV="$APP_DIR/packages/env/server.ts"

if [ -f "$SERVER_ENV" ]; then
    if grep -q "AZURE_AD_CLIENT_ID" "$SERVER_ENV"; then
        echo -e "${YELLOW}  • Azure AD env vars already exist${NC}"
    else
        node << 'NODESCRIPT'
const fs = require('fs');
const file = process.env.APP_DIR + '/packages/env/server.ts';

if (!fs.existsSync(file)) {
    console.log('  ✗ server.ts not found');
    process.exit(1);
}

let content = fs.readFileSync(file, 'utf8');

// Add Azure AD env vars after GOOGLE_CLIENT_SECRET
const googleSecret = 'GOOGLE_CLIENT_SECRET: z.string().optional(),';
const azureEnvVars = `GOOGLE_CLIENT_SECRET: z.string().optional(),
    // Microsoft Entra ID (Azure AD) Auth
    AZURE_AD_CLIENT_ID: z.string().optional(),
    AZURE_AD_CLIENT_SECRET: z.string().optional(),
    AZURE_AD_TENANT_ID: z.string().optional(),`;

if (content.includes(googleSecret) && !content.includes('AZURE_AD_CLIENT_ID')) {
    content = content.replace(googleSecret, azureEnvVars);
    fs.writeFileSync(file, content);
    console.log('  ✓ Added Azure AD environment variables');
} else if (content.includes('AZURE_AD_CLIENT_ID')) {
    console.log('  • Azure AD env vars already exist');
} else {
    console.log('  ✗ Could not find insertion point');
}
NODESCRIPT
    fi
else
    echo -e "${RED}  ✗ packages/env/server.ts not found${NC}"
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
        node << 'NODESCRIPT'
const fs = require('fs');
const file = process.env.APP_DIR + '/apps/web/utils/public-env.tsx';

if (!fs.existsSync(file)) {
    console.log('  ✗ public-env.tsx not found');
    process.exit(1);
}

let content = fs.readFileSync(file, 'utf8');

// Find googleAuthAvailable in type definition and add microsoftAuthAvailable
// The pattern should match both tabs and spaces
const typePattern = /(googleAuthAvailable:\s*boolean;)/;
const match = content.match(typePattern);

if (match && !content.includes('microsoftAuthAvailable')) {
    // Detect indentation (tab or spaces)
    const lineMatch = content.match(/^(\s*)googleAuthAvailable:/m);
    const indent = lineMatch ? lineMatch[1] : '\t';

    content = content.replace(
        match[1],
        match[1] + '\n' + indent + 'microsoftAuthAvailable: boolean;'
    );
    fs.writeFileSync(file, content);
    console.log('  ✓ Added microsoftAuthAvailable type');
} else if (content.includes('microsoftAuthAvailable')) {
    console.log('  • microsoftAuthAvailable already exists');
} else {
    console.log('  ✗ Could not find googleAuthAvailable pattern');
}
NODESCRIPT
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
        node << 'NODESCRIPT'
const fs = require('fs');
const file = process.env.APP_DIR + '/apps/web/app/layout.tsx';

if (!fs.existsSync(file)) {
    console.log('  ✗ layout.tsx not found');
    process.exit(1);
}

let content = fs.readFileSync(file, 'utf8');

// Find googleAuthAvailable assignment and add microsoftAuthAvailable
// Pattern matches: googleAuthAvailable: !!serverEnv().GOOGLE_CLIENT_ID,
const assignPattern = /(googleAuthAvailable:\s*!!serverEnv\(\)\.GOOGLE_CLIENT_ID,)/;
const match = content.match(assignPattern);

if (match && !content.includes('microsoftAuthAvailable')) {
    // Detect indentation
    const lineMatch = content.match(/^(\s*)googleAuthAvailable:/m);
    const indent = lineMatch ? lineMatch[1] : '\t\t';

    content = content.replace(
        match[1],
        match[1] + '\n' + indent + 'microsoftAuthAvailable: !!serverEnv().AZURE_AD_CLIENT_ID,'
    );
    fs.writeFileSync(file, content);
    console.log('  ✓ Added microsoftAuthAvailable to layout context');
} else if (content.includes('microsoftAuthAvailable')) {
    console.log('  • microsoftAuthAvailable already exists');
} else {
    console.log('  ✗ Could not find googleAuthAvailable pattern in layout');
    console.log('  Searching for alternative patterns...');

    // Try alternative pattern (different whitespace)
    const altPattern = /googleAuthAvailable:.*GOOGLE_CLIENT_ID.*,/;
    const altMatch = content.match(altPattern);
    if (altMatch) {
        console.log('  Found alternative pattern: ' + altMatch[0].substring(0, 50) + '...');
    }
}
NODESCRIPT
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
        node << 'NODESCRIPT'
const fs = require('fs');
const file = process.env.APP_DIR + '/apps/web/app/(org)/login/form.tsx';

if (!fs.existsSync(file)) {
    console.log('  ✗ Login form not found');
    process.exit(1);
}

let content = fs.readFileSync(file, 'utf8');
let modified = false;

// === Add handler function ===
// Find handleGoogleSignIn function and add handleMicrosoftSignIn after it
const handlerPattern = /const\s+handleGoogleSignIn\s*=\s*\(\)\s*=>\s*\{[\s\S]*?signIn\s*\(\s*["']google["'][\s\S]*?\}\s*\)\s*;\s*\}\s*;/;
const handlerMatch = content.match(handlerPattern);

if (handlerMatch && !content.includes('handleMicrosoftSignIn')) {
    // Use same indentation style as Google handler
    const microsoftHandler = `

  const handleMicrosoftSignIn = () => {
    trackEvent("auth_started", { method: "microsoft", is_signup: true });
    signIn("azure-ad", {
      ...(next && next.length > 0 ? { callbackUrl: next } : {}),
    });
  };`;

    content = content.replace(handlerMatch[0], handlerMatch[0] + microsoftHandler);
    console.log('  ✓ Added handleMicrosoftSignIn handler');
    modified = true;
} else if (content.includes('handleMicrosoftSignIn')) {
    console.log('  • handleMicrosoftSignIn already exists');
} else {
    // Fallback: Try simpler pattern
    console.log('  • Primary pattern not found, trying fallback...');
    const simplePattern = /const handleGoogleSignIn[\s\S]*?};/;
    const simpleMatch = content.match(simplePattern);

    if (simpleMatch && !content.includes('handleMicrosoftSignIn')) {
        const microsoftHandler = `

  const handleMicrosoftSignIn = () => {
    signIn("azure-ad", {
      callbackUrl: "/dashboard",
    });
  };`;
        content = content.replace(simpleMatch[0], simpleMatch[0] + microsoftHandler);
        console.log('  ✓ Added handleMicrosoftSignIn (fallback)');
        modified = true;
    }
}

// === Add Microsoft button ===
// Find Google button and add Microsoft button after it
const buttonPattern = /\{publicEnv\.googleAuthAvailable\s*&&\s*!oauthError\s*&&\s*\([\s\S]*?Login with Google[\s\S]*?<\/MotionButton>[\s\S]*?\)\}/;
const buttonMatch = content.match(buttonPattern);

if (buttonMatch && !content.includes('microsoftAuthAvailable')) {
    const microsoftButton = `
        {publicEnv.microsoftAuthAvailable && !oauthError && (
          <MotionButton
            variant="gray"
            type="button"
            className="flex gap-2 justify-center items-center w-full text-sm"
            onClick={handleMicrosoftSignIn}
            disabled={loading || emailSent}
          >
            <Image src="/microsoft.svg" alt="Microsoft" width={16} height={16} />
            Login with Microsoft
          </MotionButton>
        )}`;

    content = content.replace(buttonMatch[0], buttonMatch[0] + microsoftButton);
    console.log('  ✓ Added Microsoft login button');
    modified = true;
} else if (content.includes('microsoftAuthAvailable')) {
    console.log('  • Microsoft button already exists');
} else {
    console.log('  ✗ Could not find Google button pattern');

    // Debug: show what we're looking for
    if (content.includes('googleAuthAvailable')) {
        console.log('  Found googleAuthAvailable in file');
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('googleAuthAvailable')) {
                console.log('  Line ' + (i+1) + ': ' + lines[i].substring(0, 60));
            }
        }
    }
}

if (modified) {
    fs.writeFileSync(file, content);
    console.log('  ✓ Login form patched');
}
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
