FROM mcr.microsoft.com/devcontainers/javascript-node:20-bullseye

# Install Chromium, ffmpeg, and minimal fonts for Puppeteer/ffmpeg tests.
RUN apt-get update && \
    apt-get install -y chromium ffmpeg fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*

# Prefer the system Chromium and skip redundant downloads.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /workspace
