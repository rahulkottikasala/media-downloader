import { MediaProvider, MediaSourceResolution } from './types.js';
import type { MediaFormat, MediaMetadata, VideoResolution } from '@mediaflow/shared';
import { ytdlpService } from '../services/ytdlp.service.js';
import { formatDuration } from '../services/ffmpeg.service.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config.js';

export class WebVideoProvider implements MediaProvider {
  name = 'webvideo';

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }
      const host = parsed.hostname.toLowerCase();
      // Exclude platforms handled specifically by dedicated providers
      if (
        host.includes('youtube.com') ||
        host.includes('youtu.be') ||
        host.includes('instagram.com') ||
        host.includes('instagr.am') ||
        host.includes('terabox') ||
        host.includes('1024tera') ||
        host.includes('4funbox') ||
        host.includes('mirrobox') ||
        host.includes('nephobox')
      ) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async inspect(url: string): Promise<MediaMetadata> {
    if (ytdlpService.isAvailable()) {
      try {
        const info = await ytdlpService.inspect(url);
        const durationSec = info.duration || 0;

        const availableResolutions: VideoResolution[] = ['original'];
        if (info.height) {
          if (info.height >= 1080) availableResolutions.push('1080p');
          if (info.height >= 720) availableResolutions.push('720p');
          if (info.height >= 480) availableResolutions.push('480p');
          if (info.height >= 360) availableResolutions.push('360p');
        } else {
          availableResolutions.push('1080p', '720p', '480p', '360p');
        }

        return {
          supported: true,
          platform: 'webvideo',
          title: info.title || 'Web Video',
          thumbnail: info.thumbnail,
          previewUrl: info.previewUrl ? `/api/media/proxy?url=${encodeURIComponent(info.previewUrl)}` : undefined,
          duration: durationSec,
          durationFormatted: formatDuration(durationSec),
          sourceUrl: url,
          width: info.width,
          height: info.height,
          resolutionLabel: info.height ? `${info.height}p` : undefined,
          hasVideo: true,
          hasAudio: true,
          availableResolutions,
          availableFormats: ['original', 'mp4', 'webm', 'mp3', 'm4a', 'wav'],
        };
      } catch (err: any) {
        console.error('WebVideo yt-dlp inspect error:', err);
      }
    }

    return {
      supported: false,
      platform: 'webvideo',
      title: 'Web Video Detected',
      sourceUrl: url,
      hasVideo: false,
      hasAudio: false,
      availableResolutions: ['original'],
      availableFormats: ['original'],
      message: 'Video metadata could not be retrieved from this link.',
    };
  }

  async getFormats(_url: string): Promise<MediaFormat[]> {
    return ['original', 'mp4', 'webm', 'mp3', 'm4a', 'wav'];
  }

  async resolveAuthorizedSource(
    url: string,
    _format?: MediaFormat,
    onProgress?: (progressPercent: number, message: string) => void
  ): Promise<MediaSourceResolution> {
    if (!ytdlpService.isAvailable()) {
      throw new Error('yt-dlp is required to extract this web video stream.');
    }

    const tempDownloadDir = path.join(config.tempDir, `webv-${crypto.randomUUID()}`);
    fs.mkdirSync(tempDownloadDir, { recursive: true });

    const downloadedFilePath = await ytdlpService.download(url, tempDownloadDir, onProgress);

    return {
      filePath: downloadedFilePath,
    };
  }
}
