# =============================================================================
# Cap Screen Recorder - BAUER GROUP Edition
# Custom image with branding assets
# =============================================================================
#
# This Dockerfile builds a customized Cap image with:
# - BAUER GROUP branding (logo, favicon)
# - Optional code patches
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
# Copy customization scripts and assets
# =============================================================================

# Copy patches (for future code modifications)
COPY patches/ /patches/

# Copy branding assets and scripts
COPY branding/ /branding/

# =============================================================================
# Apply Patches (if any)
# =============================================================================

RUN chmod +x /patches/apply-patches.sh 2>/dev/null || true && \
    if [ -f /patches/apply-patches.sh ]; then \
        PATCHES_DIR=/patches APP_DIR=/app /patches/apply-patches.sh; \
    fi

# =============================================================================
# Apply Branding
# =============================================================================

RUN if [ "$INCLUDE_BRANDING" = "true" ]; then \
        chmod +x /branding/apply-branding.sh 2>/dev/null || true && \
        if [ -f /branding/apply-branding.sh ]; then \
            BRANDING_DIR=/branding /branding/apply-branding.sh; \
        fi; \
    else \
        echo "Branding disabled."; \
    fi

# =============================================================================
# Cleanup
# =============================================================================

RUN rm -rf /patches /branding

# =============================================================================
# Health Check
# =============================================================================
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q --spider http://localhost:3000/api/health || exit 1

EXPOSE 3000
