# MediaFlow — All Your Media. One Simple Tool.

> **Download. Convert. Enjoy.**  
> A production-ready, full-stack media downloader, transcode engine, and compressor built with React 19, Express.js, TypeScript, and FFmpeg.

---

## 🌟 Key Features

- **Direct Media Downloader:** Paste direct HTTP/HTTPS video and audio links (MP4, WebM, MP3, WAV, AAC, M4A) with real-time inspection.
- **MP3 & Audio Extraction:** Extract high-fidelity audio with customizable bitrates (`64k` to `320k`).
- **Resolution Control:** Transcode to `144p`, `240p`, `360p`, `480p`, `720p`, `1080p`, `1440p`, `2160p` (no artificial upscaling).
- **Smart Video Compressor:** Presets (`High Quality`, `Balanced`, `Small File`) plus advanced controls (`CRF`, video/audio bitrate, frame rate).
- **Batch Converter:** Convert multiple local files with sequential queueing, progress tracking, and **Download All as ZIP**.
- **Real-Time Progress:** Live job progress updates via Server-Sent Events (SSE).
- **Enterprise Security:** Built-in SSRF protection (DNS resolution validation, loopback & private IP blocking), temporary directory isolation, safe filename sanitization, and anonymous access tokens.
- **Platform Compliance:** Complies with platform terms without attempting DRM or anti-bot bypasses.

---

## 🏗️ Architecture

```
mediaflow/
├── apps/
│   ├── web/               # React 19 + Vite + TypeScript + Tailwind CSS + Lucide + Motion
│   └── api/               # Node.js + Express + TypeScript + FFmpeg / FFprobe + SSE
├── packages/
│   └── shared/            # Shared TypeScript types, Zod schemas, job models
├── tests/
│   └── fixtures/          # Deterministic media test fixtures
├── scripts/
│   ├── generate-fixtures.mjs  # Generates test audio/video files
│   └── run-all-tests.mjs      # Comprehensive verification test suite
├── Dockerfile
├── docker-compose.yml
├── TEST_REPORT.md
└── package.json
```

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- Node.js LTS (v20+ or v22+)
- pnpm (v9+ or v10+)
- FFmpeg & FFprobe

```bash
# macOS (via Homebrew)
brew install ffmpeg

# Ubuntu / Debian
sudo apt-get update && sudo apt-get install -y ffmpeg
```

### Install Dependencies
```bash
pnpm install
```

### Build Packages
```bash
pnpm build
```

### Start Local Development Servers

```bash
# Runs both Frontend (5173) and Backend (3001) concurrently
pnpm dev
```

- **Frontend Web UI:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:3001](http://localhost:3001)
- **Health Check:** [http://localhost:3001/api/health](http://localhost:3001/api/health)

---

## 🧪 Testing

```bash
# Run unit & API integration tests
pnpm test

# Generate local test fixtures
pnpm fixtures

# Run comprehensive end-to-end media download & conversion test suite
node scripts/run-all-tests.mjs
```

---

## 🐳 Docker Deployment

Run with Docker Compose:

```bash
docker-compose up --build -d
```

The app will be available on `http://localhost:3001` with containerized FFmpeg and healthcheck enabled.
