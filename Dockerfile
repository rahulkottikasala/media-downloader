# ==========================================
# Multi-stage Dockerfile for MediaFlow
# ==========================================

FROM node:22-bookworm-slim AS base
WORKDIR /app

# Install FFmpeg, yt-dlp and dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates curl python3 && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Enable Corepack & pnpm
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate

# Copy monorepo manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY apps/web ./apps/web

# Build all packages
RUN pnpm build

# Production Runner
FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates curl python3 && \
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe
ENV YTDLP_PATH=/usr/local/bin/yt-dlp

# Copy the entire workspace with all node_modules symlinks and dist directories intact
COPY --from=base /app ./

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
