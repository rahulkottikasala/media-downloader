import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { formatDuration } from './ffmpeg.service.js';

export interface YtDlpMediaInfo {
  id: string;
  title: string;
  thumbnail?: string;
  duration?: number;
  width?: number;
  height?: number;
  uploader?: string;
  extractor?: string;
  isPlaylist?: boolean;
  entries?: Array<{
    id: string;
    title: string;
    duration?: number;
    url: string;
    thumbnail?: string;
  }>;
}

export class YtDlpService {
  isAvailable(): boolean {
    return fs.existsSync(config.ytdlpPath);
  }

  async inspect(url: string): Promise<YtDlpMediaInfo> {
    const isPlaylist = url.includes('/playlist') || url.includes('&list=') || url.includes('?list=');
    const args = [
      '--dump-single-json',
      '--no-warnings',
      '--no-check-certificates',
    ];

    if (isPlaylist) {
      args.push('--flat-playlist');
    }

    args.push(url);

    return new Promise((resolve, reject) => {
      const child = spawn(config.ytdlpPath, args);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => {
        stdout += d.toString();
      });
      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Media inspection timed out'));
      }, 45000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          return reject(new Error(stderr || `yt-dlp exited with code ${code}`));
        }

        try {
          const json = JSON.parse(stdout);
          const isPlay = json._type === 'playlist' || Array.isArray(json.entries);

          if (isPlay && Array.isArray(json.entries)) {
            const entries = json.entries.slice(0, 50).map((entry: any) => ({
              id: entry.id,
              title: entry.title || 'Untitled Video',
              duration: entry.duration,
              url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
              thumbnail: entry.thumbnails?.[0]?.url || entry.thumbnail,
            }));

            return resolve({
              id: json.id || 'playlist',
              title: json.title || 'YouTube Playlist',
              thumbnail: entries[0]?.thumbnail,
              isPlaylist: true,
              entries,
            });
          }

          resolve({
            id: json.id,
            title: json.title || 'Video',
            thumbnail: json.thumbnail,
            duration: json.duration,
            width: json.width,
            height: json.height,
            uploader: json.uploader,
            extractor: json.extractor,
            isPlaylist: false,
          });
        } catch (err: any) {
          reject(new Error(`Failed to parse yt-dlp metadata: ${err.message}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
      });
    });
  }

  async download(url: string, outputDir: string, onProgress?: (msg: string) => void): Promise<string> {
    const outputTemplate = path.join(outputDir, '%(title).80s-%(id)s.%(ext)s');
    const args = [
      '--no-warnings',
      '--no-check-certificates',
      '-f',
      'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4] / bv*+ba/b',
      '--merge-output-format',
      'mp4',
      '-o',
      outputTemplate,
      url,
    ];

    return new Promise((resolve, reject) => {
      const child = spawn(config.ytdlpPath, args);
      let stderr = '';

      child.stdout.on('data', (d) => {
        const text = d.toString();
        if (onProgress) {
          onProgress(text);
        }
      });

      child.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Media download timed out'));
      }, 10 * 60 * 1000);

      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          return reject(new Error(stderr || `yt-dlp download failed with code ${code}`));
        }

        // Find the downloaded file in outputDir
        const files = fs.readdirSync(outputDir).filter((f) => !f.startsWith('.'));
        if (files.length === 0) {
          return reject(new Error('Downloaded file not found in output directory'));
        }

        // Return the downloaded file path
        const downloadedFile = path.join(outputDir, files[0]);
        resolve(downloadedFile);
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start yt-dlp downloader: ${err.message}`));
      });
    });
  }
}

export const ytdlpService = new YtDlpService();
