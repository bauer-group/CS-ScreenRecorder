#!/bin/bash
###############################################################################
# Screen Recorder - Secret Generator
# Generates secure random secrets for use in .env configuration
#
# Required secrets for Cap:
# - NEXTAUTH_SECRET (32 byte base64)
# - DATABASE_ENCRYPTION_KEY (32 byte hex)
# - DATABASE_PASSWORD
# - MINIO_ROOT_PASSWORD
# - CAP_AWS_SECRET_KEY
###############################################################################

set -euo pipefail

# Configuration
SCRIPT_DIR="$(dirname "$0")"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
ENV_EXAMPLE="$PROJECT_DIR/.env.example"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Screen Recorder - Secret Generator${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if openssl is available
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}Error: OpenSSL is not installed${NC}"
    echo "Install it with: brew install openssl (macOS) or apt install openssl (Linux)"
    exit 1
fi

# Generate secrets
echo -e "${BLUE}Generating secrets...${NC}"

# Note: We avoid special characters (+, /, =, $, etc.) in secrets
# to prevent shell escaping issues in docker-compose and scripts.

# NextAuth secret (alphanumeric, 43 chars = ~256 bits entropy)
NEXTAUTH_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 43)

# Database encryption key (32 byte hex string - hex is shell-safe)
DATABASE_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Database password (alphanumeric, 32 chars)
DATABASE_PASSWORD=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 32)

# MinIO root password (alphanumeric, 32 chars)
MINIO_ROOT_PASSWORD=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 32)

# Cap S3 secret key (alphanumeric, 40 chars - AWS style, shell-safe)
CAP_AWS_SECRET_KEY=$(openssl rand -base64 60 | tr -dc 'a-zA-Z0-9' | head -c 40)

echo -e "${GREEN}Secrets generated successfully!${NC}"
echo ""

# Check if .env exists
UPDATE_ENV=false
if [[ -f "$ENV_FILE" ]]; then
    echo -e "${YELLOW}Found existing .env file${NC}"
    read -p "Do you want to update it with new secrets? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        UPDATE_ENV=true
    fi
else
    # Create .env from .env.example
    if [[ -f "$ENV_EXAMPLE" ]]; then
        echo -e "${BLUE}Creating .env from .env.example...${NC}"
        cp "$ENV_EXAMPLE" "$ENV_FILE"
        UPDATE_ENV=true
    else
        echo -e "${RED}Error: .env.example not found${NC}"
        exit 1
    fi
fi

# Display secrets
echo ""
echo -e "${BLUE}Generated Secrets:${NC}"
echo "=========================================="
echo ""
echo -e "  ${GREEN}NEXTAUTH_SECRET${NC}=$NEXTAUTH_SECRET"
echo -e "  ${GREEN}DATABASE_ENCRYPTION_KEY${NC}=$DATABASE_ENCRYPTION_KEY"
echo -e "  ${GREEN}DATABASE_PASSWORD${NC}=$DATABASE_PASSWORD"
echo -e "  ${GREEN}MINIO_ROOT_PASSWORD${NC}=$MINIO_ROOT_PASSWORD"
echo -e "  ${GREEN}CAP_AWS_SECRET_KEY${NC}=$CAP_AWS_SECRET_KEY"
echo ""
echo "=========================================="

# Update .env file if requested
if [[ "$UPDATE_ENV" == true ]]; then
    echo ""
    echo -e "${BLUE}Updating .env file...${NC}"

    # Function to update or add a variable
    update_env_var() {
        local var_name="$1"
        local var_value="$2"
        local file="$3"

        # Escape special characters in the value for sed
        local escaped_value=$(printf '%s\n' "$var_value" | sed 's/[&/\]/\\&/g')

        if grep -q "^${var_name}=" "$file"; then
            # Variable exists, update it
            if [[ "$(uname)" == "Darwin" ]]; then
                sed -i '' "s|^${var_name}=.*|${var_name}=${escaped_value}|" "$file"
            else
                sed -i "s|^${var_name}=.*|${var_name}=${escaped_value}|" "$file"
            fi
        else
            # Variable doesn't exist, add it
            echo "${var_name}=${var_value}" >> "$file"
        fi
    }

    update_env_var "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET" "$ENV_FILE"
    update_env_var "DATABASE_ENCRYPTION_KEY" "$DATABASE_ENCRYPTION_KEY" "$ENV_FILE"
    update_env_var "DATABASE_PASSWORD" "$DATABASE_PASSWORD" "$ENV_FILE"
    update_env_var "MINIO_ROOT_PASSWORD" "$MINIO_ROOT_PASSWORD" "$ENV_FILE"
    update_env_var "CAP_AWS_SECRET_KEY" "$CAP_AWS_SECRET_KEY" "$ENV_FILE"

    echo -e "${GREEN}.env file updated!${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN} Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Generated secrets for:${NC}"
echo "  - NextAuth session encryption"
echo "  - Database field encryption"
echo "  - MySQL database authentication"
echo "  - MinIO admin access"
echo "  - Cap S3 service account"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review .env file and configure:"
echo "     - WEB_URL (your domain)"
echo "     - SERVICE_HOSTNAME, S3_HOSTNAME, S3_CONSOLE_HOSTNAME"
echo "     - Optional: Email (RESEND_API_KEY), OAuth, AI features"
echo ""
echo "  2. Start the development stack:"
echo "     docker compose -f docker-compose.development.yml up -d"
echo ""
echo "  3. Or start production with Traefik:"
echo "     docker compose -f docker-compose.traefik.yml up -d"
echo ""
echo "  4. Access Cap at http://localhost:3000 (dev) or https://your-domain (prod)"
echo ""
echo -e "${YELLOW}Note:${NC} If email is not configured, login links will be"
echo "      written to the container logs. View with:"
echo "      docker logs \${STACK_NAME}_APP"
echo ""
echo -e "${GREEN}========================================${NC}"
