# syntax=docker.io/docker/dockerfile:1
# =============================================================================
# Screen Recorder Media Server - BAUER GROUP Edition
# FFmpeg-based media processing microservice
# =============================================================================
#
# Features:
#   - Video transcoding and processing
#   - Audio extraction and conversion
#   - Thumbnail generation
#   - Stateless worker (receives presigned URLs from cap-web)
#
# Build:
#   docker build -t screen-recorder-mediaserver ./src/mediaserver
#   docker build --build-arg CAP_VERSION=cap-v0.4.82 -t screen-recorder-mediaserver ./src/mediaserver
#
# Source: https://github.com/CapSoftware/Cap/tree/main/apps/media-server
#
# =============================================================================

# -----------------------------------------------------------------------------
# Build Arguments
# -----------------------------------------------------------------------------
ARG CAP_VERSION=cap-v0.4.82

# =============================================================================
# Stage 1: Source Fetcher
# =============================================================================
FROM oven/bun:1-alpine AS source

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
# Stage 2: Production Runtime
# =============================================================================
FROM oven/bun:1-alpine

# Install FFmpeg (required for media processing) and wget (for healthcheck)
RUN apk add --no-cache ffmpeg wget

ARG CAP_VERSION

WORKDIR /app

# Copy media-server source from fetcher
COPY --from=source /src/apps/media-server/package.json ./

# Install production dependencies
RUN bun install --production

# Copy application source
COPY --from=source /src/apps/media-server/src ./src

# =============================================================================
# Metadata Labels
# =============================================================================

# Metadata
LABEL vendor="BAUER GROUP"
LABEL maintainer="Karl Bauer <karl.bauer@bauer-group.com>"

# Opencontainers Metadata
LABEL org.opencontainers.image.title="Screen Recorder Media Server [BAUER GROUP]"
LABEL org.opencontainers.image.licenses="AGPL-3.0"
LABEL org.opencontainers.image.vendor="BAUER GROUP"
LABEL org.opencontainers.image.authors="Karl Bauer <karl.bauer@bauer-group.com>"
LABEL org.opencontainers.image.source="https://github.com/bauer-group/CS-ScreenRecorder"
LABEL org.opencontainers.image.url="https://github.com/bauer-group/CS-ScreenRecorder"
LABEL org.opencontainers.image.documentation="https://github.com/bauer-group/CS-ScreenRecorder#readme"
LABEL org.opencontainers.image.description="Screen Recorder Media Server - BAUER GROUP Edition"
LABEL org.opencontainers.image.version="0.11.0"

# Extended Labels
LABEL org.opencontainers.image.base.name="https://github.com/CapSoftware/Cap#${CAP_VERSION}"
LABEL com.bauer-group.image.version="${CAP_VERSION}"
LABEL com.bauer-group.image.build.type="custom"

# =============================================================================
# Runtime Configuration
# =============================================================================
ENV PORT=3456

EXPOSE 3456

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:${PORT}/health || exit 1

CMD ["bun", "run", "src/index.ts"]
