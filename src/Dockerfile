# syntax=docker.io/docker/dockerfile:1
# =============================================================================
# Screen Recorder - BAUER GROUP Edition
# Multi-stage build from source with Microsoft Entra ID support
# =============================================================================
#
# Features:
#   - Microsoft Entra ID (Azure AD) authentication
#     - Single tenant (organization only)
#     - Multi-tenant (any Microsoft account)
#   - BAUER GROUP branding (logo, favicon)
#   - Custom code patches
#
# Build:
#   docker build -t screen-recording ./src
#   docker build --build-arg CAP_VERSION=cap-v0.4.0 -t screen-recording ./src
#
# Documentation: https://cap.so/docs/self-hosting
# Source: https://github.com/CapSoftware/Cap
#
# =============================================================================

# -----------------------------------------------------------------------------
# Build Arguments
# -----------------------------------------------------------------------------
ARG CAP_VERSION=cap-v0.3.83
ARG NODE_VERSION=24
ARG INCLUDE_BRANDING=true

# Note: Branding is configured via src/branding/branding.env

# =============================================================================
# Stage 1: Base Image
# =============================================================================
FROM node:${NODE_VERSION}-alpine AS base

RUN corepack enable

# =============================================================================
# Stage 2: Source Fetcher
# =============================================================================
FROM base AS source

RUN apk add --no-cache git

ARG CAP_VERSION

WORKDIR /src

# Clone Cap repository
RUN if [ "$CAP_VERSION" = "main" ] || [ "$CAP_VERSION" = "latest" ]; then \
        echo "==> Cloning Cap main branch..." && \
        git clone --depth 1 https://github.com/CapSoftware/Cap.git .; \
    else \
        echo "==> Cloning Cap version: $CAP_VERSION" && \
        git clone --depth 1 --branch "$CAP_VERSION" https://github.com/CapSoftware/Cap.git .; \
    fi && \
    echo "==> Cap source: $(git describe --tags --always 2>/dev/null || echo 'main')"

# =============================================================================
# Stage 3: Patcher (Apply code modifications)
# =============================================================================
FROM base AS patcher

RUN apk add --no-cache bash sed gawk

WORKDIR /app

# Copy source code from fetcher
COPY --from=source /src .

# Copy custom patches and branding configuration
COPY patches/ /patches/
COPY branding/branding.env /branding/branding.env

# Apply patches (Microsoft Entra ID, SMTP, Branding, etc.)
# Patches are applied to TypeScript source BEFORE build
RUN chmod +x /patches/apply-patches.sh 2>/dev/null || true && \
    if [ -f /patches/apply-patches.sh ]; then \
        echo "==> Applying patches..." && \
        PATCHES_DIR=/patches APP_DIR=/app \
        BRANDING_ENV=/branding/branding.env \
        /patches/apply-patches.sh; \
    else \
        echo "==> No patches to apply"; \
    fi

# =============================================================================
# Stage 4: Builder (Install deps & compile)
# =============================================================================
FROM base AS builder

WORKDIR /app

# Copy patched source
COPY --from=patcher /app .

# Install dependencies with pnpm cache
# Note: Using --no-frozen-lockfile because patches may add dependencies (e.g., nodemailer)
RUN corepack enable pnpm
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm i --no-frozen-lockfile

ARG NEXT_PUBLIC_DOCKER_BUILD=true

# Build-time environment (required by @cap/env validation)
# These are placeholder values - real values come from container runtime environment
ENV NEXT_PUBLIC_WEB_URL="http://localhost:3000" \
    WEB_URL="http://localhost:3000" \
    DATABASE_URL="mysql://build:build@localhost:3306/cap" \
    NEXTAUTH_SECRET="build-time-placeholder-secret-32chars" \
    NEXTAUTH_URL="http://localhost:3000" \
    CAP_AWS_BUCKET="build-bucket" \
    CAP_AWS_REGION="global" \
    NODE_ENV="production"

# Build the web application
RUN pnpm run build:web

# =============================================================================
# Stage 5: Production Runtime
# =============================================================================
FROM base AS runner

ARG INCLUDE_BRANDING
ARG CAP_VERSION

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built application (Next.js standalone output)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/packages/database/migrations ./apps/web/migrations

# Copy and apply branding
COPY branding/ /branding/

RUN apk add --no-cache bash && \
    if [ "$INCLUDE_BRANDING" = "true" ] && [ -f /branding/apply-branding.sh ]; then \
        chmod +x /branding/apply-branding.sh && \
        echo "==> Applying branding..." && \
        BRANDING_DIR=/branding /branding/apply-branding.sh; \
    fi && \
    rm -rf /branding && \
    apk del bash

# =============================================================================
# Metadata Labels
# =============================================================================

# Metadata
LABEL vendor="BAUER GROUP"
LABEL maintainer="Karl Bauer <karl.bauer@bauer-group.com>"

# Opencontainers Metadata
LABEL org.opencontainers.image.title="Screen Recorder [BAUER GROUP]"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="BAUER GROUP"
LABEL org.opencontainers.image.authors="Karl Bauer <karl.bauer@bauer-group.com>"
LABEL org.opencontainers.image.source="https://github.com/bauer-group/CS-ScreenRecorder"
LABEL org.opencontainers.image.url="https://github.com/bauer-group/CS-ScreenRecorder"
LABEL org.opencontainers.image.documentation="https://github.com/bauer-group/CS-ScreenRecorder#readme"
LABEL org.opencontainers.image.description="Screen Recorder - BAUER GROUP Edition"
LABEL org.opencontainers.image.version="0.4.3"

# Extended Labels
LABEL org.opencontainers.image.base.name="https://github.com/CapSoftware/Cap#${CAP_VERSION}"
LABEL com.bauer-group.image.version="${CAP_VERSION}"
LABEL com.bauer-group.image.build.type="custom"

# =============================================================================
# Runtime Configuration
# =============================================================================
USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
