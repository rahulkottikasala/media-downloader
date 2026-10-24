import { MediaProvider, MediaSourceResolution } from './types.js';
import type { MediaFormat, MediaMetadata } from '@mediaflow/shared';
import { ytdlpService } from '../services/ytdlp.service.js';
import { formatDuration } from '../services/ffmpeg.service.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config.js';

export class InstagramProvider implements MediaProvider {
  name = 'instagram';

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (host === 'www.instagram.com' || host === 'instagram.com' || host === 'instagr.am') {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  detectSubtype(url: string): 'reel' | 'post' | 'tv' | 'unknown' {
    try {
      const parsed = new URL(url);
      const p = parsed.pathname;
      if (p.startsWith('/reel/') || p.startsWith('/reels/')) {
        return 'reel';
      }
      if (p.startsWith('/p/')) {
        return 'post';
      }
      if (p.startsWith('/tv/')) {
        return 'tv';
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  async inspect(url: string): Promise<MediaMetadata> {
    if (ytdlpService.isAvailable()) {
      try {
        const info = await ytdlpService.inspect(url);
        const durationSec = info.duration || 0;

        return {
          supported: true,
          platform: 'instagram',
          title: info.title || 'Instagram Video',
          thumbnail: info.thumbnail,
          duration: durationSec,
          durationFormatted: formatDuration(durationSec),
          sourceUrl: url,
          width: info.width,
          height: info.height,
          resolutionLabel: info.height ? `${info.height}p` : undefined,
          hasVideo: true,
          hasAudio: true,
          availableResolutions: ['original', '1080p', '720p', '480p'],
          availableFormats: ['original', 'mp4', 'webm', 'mp3', 'm4a'],
        };
      } catch (err: any) {
        console.error('Instagram yt-dlp inspect error:', err);
      }
    }

    const subtype = this.detectSubtype(url);
    const subtypeLabel =
      subtype === 'reel'
        ? 'Instagram Reel'
        : subtype === 'post'
          ? 'Instagram Video Post'
          : subtype === 'tv'
            ? 'Instagram TV'
            : 'Instagram Media';

    return {
      supported: false,
      platform: 'instagram',
      title: `${subtypeLabel} Detected`,
      sourceUrl: url,
      hasVideo: false,
      hasAudio: false,
      availableResolutions: ['original'],
      availableFormats: ['original'],
      message: 'URL detection works, but media downloading is unsupported by the configured provider.',
    };
  }

  async getFormats(_url: string): Promise<MediaFormat[]> {
    return ['original', 'mp4', 'webm', 'mp3', 'm4a'];
  }

  async resolveAuthorizedSource(
    url: string,
    _format?: MediaFormat,
    onProgress?: (progressPercent: number, message: string) => void
  ): Promise<MediaSourceResolution> {
    if (!ytdlpService.isAvailable()) {
      throw new Error('URL detection works, but media downloading is unsupported by the configured provider.');
    }

    const tempDownloadDir = path.join(config.tempDir, `igdl-${crypto.randomUUID()}`);
    fs.mkdirSync(tempDownloadDir, { recursive: true });

    const downloadedFilePath = await ytdlpService.download(url, tempDownloadDir, onProgress);

    return {
      filePath: downloadedFilePath,
    };
  }
}
