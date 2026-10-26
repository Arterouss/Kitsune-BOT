FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies: ffmpeg, python3, curl, git, yt-dlp
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    git \
    ca-certificates && \
    curl -sSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Setup non-root user required by Hugging Face Spaces
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PORT=7860

WORKDIR $HOME/app

# Copy package files and install dependencies
COPY --chown=user:user package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copy app source
COPY --chown=user:user . .

EXPOSE 7860

CMD ["node", "index.js"]
