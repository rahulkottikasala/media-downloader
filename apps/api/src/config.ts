import path from 'path';
import os from 'os';
import fs from 'fs';

function findBinary(name: string, fallbackPaths: string[]): string {
  if (process.env[name.toUpperCase() + '_PATH']) {
    return process.env[name.toUpperCase() + '_PATH']!;
  }
  for (const p of fallbackPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return name;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  maxUploadSizeBytes: 500 * 1024 * 1024, // 500MB limit
  maxDownloadSizeBytes: 1024 * 1024 * 1024, // 1GB
  maxConcurrentJobs: 3,
  jobTimeoutMs: 10 * 60 * 1000, // 10 minutes timeout per job
  jobRetentionMs: 30 * 60 * 1000, // 30 minutes retention
  tempDir: process.env.TEMP_DIR || path.join(os.tmpdir(), 'mediaflow-jobs'),
  uploadDir: process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'mediaflow-uploads'),
  ffmpegPath: findBinary('ffmpeg', ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg']),
  ffprobePath: findBinary('ffprobe', ['/opt/homebrew/bin/ffprobe', '/usr/local/bin/ffprobe', '/usr/bin/ffprobe']),
  ytdlpPath: findBinary('yt-dlp', ['/opt/homebrew/bin/yt-dlp', '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp']),
};

// Ensure directories exist
if (!fs.existsSync(config.tempDir)) {
  fs.mkdirSync(config.tempDir, { recursive: true });
}
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}
