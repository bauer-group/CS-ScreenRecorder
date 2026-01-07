# =============================================================================
# Cap Screen Recorder - BAUER GROUP Edition
# Custom image with branding assets
# =============================================================================
#
# This Dockerfile builds a customized Cap image with:
# - BAUER GROUP branding (logo, favicon)
# - Custom configuration defaults
#
# USAGE:
#   docker build -t screen-recording .
#   docker build --build-arg CAP_VERSION=latest -t screen-recording .
#
# See: https://cap.so/docs/self-hosting
#
# =============================================================================

ARG CAP_VERSION=latest
FROM ghcr.io/capsoftware/cap:${CAP_VERSION}

# Re-declare ARGs after FROM to use them
ARG CAP_VERSION
ARG INCLUDE_BRANDING=true

# =============================================================================
# Custom Labels
# =============================================================================

# Metadata
LABEL vendor="BAUER GROUP"
LABEL maintainer="Karl Bauer <karl.bauer@bauer-group.com>"

# Opencontainers Metadata
LABEL org.opencontainers.image.title="Cap Screen Recorder [BAUER GROUP]"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="BAUER GROUP"
LABEL org.opencontainers.image.authors="Karl Bauer <karl.bauer@bauer-group.com>"
LABEL org.opencontainers.image.source="https://github.com/bauer-group/CS-ScreenRecording"
LABEL org.opencontainers.image.url="https://github.com/bauer-group/CS-ScreenRecording"
LABEL org.opencontainers.image.documentation="https://github.com/bauer-group/CS-ScreenRecording#readme"
LABEL org.opencontainers.image.description="Cap Screen Recorder - BAUER GROUP Edition"
LABEL org.opencontainers.image.version="0.0.0"

# Extended Labels
LABEL org.opencontainers.image.base.name="ghcr.io/capsoftware/cap:${CAP_VERSION}"
LABEL com.bauer-group.cap.version="${CAP_VERSION}"

# =============================================================================
# Apply Branding (if available)
# =============================================================================
# Cap branding is applied by replacing static assets in the Next.js public folder
# The exact paths depend on Cap's internal structure

# Copy branding assets if they exist
COPY branding/ /tmp/branding/

# Create branding application script
RUN if [ "$INCLUDE_BRANDING" = "true" ] && [ -d "/tmp/branding" ]; then \
        echo "=== Preparing BAUER GROUP branding assets ==="; \
        # Create branding directory for reference
        mkdir -p /app/branding; \
        # Copy all branding source files
        cp -r /tmp/branding/* /app/branding/ 2>/dev/null || true; \
        # Try to find and replace favicon/logo in common Next.js locations
        # Cap uses Next.js, so assets are typically in /app/public or /app/.next/static
        for target_dir in /app/public /app/apps/web/public /app/.next/static; do \
            if [ -d "$target_dir" ]; then \
                echo "Found asset directory: $target_dir"; \
                # Copy favicon if exists
                if [ -f "/tmp/branding/assets/favicon.ico" ]; then \
                    cp /tmp/branding/assets/favicon.ico "$target_dir/favicon.ico" 2>/dev/null || true; \
                    echo "  Applied favicon.ico"; \
                fi; \
                # Copy logo if exists
                if [ -f "/tmp/branding/assets/logo.png" ]; then \
                    cp /tmp/branding/assets/logo.png "$target_dir/logo.png" 2>/dev/null || true; \
                    echo "  Applied logo.png"; \
                fi; \
            fi; \
        done; \
        echo ""; \
        echo "Branding assets staged in /app/branding/"; \
        ls -la /app/branding/ 2>/dev/null || echo "No branding files found"; \
    else \
        echo "Branding disabled or no assets found."; \
    fi && \
    rm -rf /tmp/branding

# =============================================================================
# Health Check
# =============================================================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q --spider http://localhost:3000/api/health || exit 1

# =============================================================================
# Default Port
# =============================================================================
EXPOSE 3000
