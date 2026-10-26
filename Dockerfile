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

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copy app source
COPY . .

EXPOSE 8080

CMD ["node", "index.js"]
