# =============================================================================
# Development Tools Container for Cap Screen Recorder
# All tools needed for branding asset generation and secret management
# Using Ubuntu for better package compatibility (especially Inkscape)
# =============================================================================

FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install all required tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core utilities
    bash \
    coreutils \
    grep \
    sed \
    # OpenSSL for secret generation
    openssl \
    # ImageMagick for logo/favicon generation (with SVG support)
    imagemagick \
    librsvg2-bin \
    # Inkscape for EPS/SVG conversion (works reliably on Ubuntu)
    inkscape \
    # Ghostscript for PDF/EPS processing
    ghostscript \
    # PDF to SVG conversion
    pdf2svg \
    # PNG optimization
    pngquant \
    # Docker CLI (to interact with host Docker for building images)
    docker.io \
    # Editors
    nano \
    vim \
    # Useful extras
    curl \
    jq \
    git \
    ca-certificates \
    # Node.js (for potential Cap build customization)
    nodejs \
    npm \
    # Cleanup
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set bash as default shell
SHELL ["/bin/bash", "-c"]

# Working directory (will be mounted from host)
WORKDIR /workspace

# Default command: interactive bash
CMD ["/bin/bash"]
