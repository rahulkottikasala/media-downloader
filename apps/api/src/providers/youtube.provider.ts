import { MediaProvider, MediaSourceResolution } from './types.js';
import type { MediaFormat, MediaMetadata, VideoResolution } from '@mediaflow/shared';
import { ytdlpService } from '../services/ytdlp.service.js';
import { formatDuration } from '../services/ffmpeg.service.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config.js';

export class YouTubeProvider implements MediaProvider {
  name = 'youtube';

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (
        host === 'www.youtube.com' ||
        host === 'youtube.com' ||
        host === 'm.youtube.com' ||
        host === 'youtu.be'
      ) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  detectSubtype(url: string): 'playlist' | 'shorts' | 'short_link' | 'standard' | 'unknown' {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const p = parsed.pathname;

      if (p.includes('/playlist') || parsed.searchParams.has('list')) {
        return 'playlist';
      }
      if (host === 'youtu.be') {
        return 'short_link';
      }
      if (p.startsWith('/shorts/')) {
        return 'shorts';
      }
      if (p === '/watch' || p.startsWith('/embed/')) {
        return 'standard';
      }
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  extractVideoId(url: string): string | null {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.toLowerCase() === 'youtu.be') {
        return parsed.pathname.replace(/^\//, '').split('?')[0];
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.replace('/shorts/', '').split('/')[0].split('?')[0];
      }
      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.replace('/embed/', '').split('/')[0].split('?')[0];
      }
      return parsed.searchParams.get('v');
    } catch {
      return null;
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

        const videoId = info.id || this.extractVideoId(url);

        return {
          supported: true,
          platform: 'youtube',
          title: info.title,
          thumbnail: info.thumbnail,
          embedUrl: videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1` : undefined,
          duration: durationSec,
          durationFormatted: formatDuration(durationSec),
          sourceUrl: url,
          width: info.width,
          height: info.height,
          resolutionLabel: info.height ? `${info.height}p` : undefined,
          hasVideo: true,
          hasAudio: true,
          isPlaylist: info.isPlaylist,
          playlistCount: info.entries?.length,
          playlistEntries: info.entries?.map((e) => ({
            ...e,
            durationFormatted: e.duration ? formatDuration(e.duration) : undefined,
          })),
          availableResolutions,
          availableFormats: ['original', 'mp4', 'webm', 'mp3', 'm4a', 'wav'],
        };
      } catch (err: any) {
        console.error('yt-dlp inspect failed:', err);
      }
    }

    const subtype = this.detectSubtype(url);
    const subtypeLabel =
      subtype === 'shorts'
        ? 'YouTube Shorts'
        : subtype === 'short_link'
          ? 'YouTube Short Link'
          : subtype === 'playlist'
            ? 'YouTube Playlist'
            : 'YouTube Video';

    return {
      supported: false,
      platform: 'youtube',
      title: `${subtypeLabel} Detected`,
      hasVideo: false,
      hasAudio: false,
      availableResolutions: ['original'],
      availableFormats: ['original'],
      message: 'URL detection works, but media downloading is unsupported by the configured provider.',
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
      throw new Error('URL detection works, but media downloading is unsupported by the configured provider.');
    }

    const tempDownloadDir = path.join(config.tempDir, `ytdl-${crypto.randomUUID()}`);
    fs.mkdirSync(tempDownloadDir, { recursive: true });

    const downloadedFilePath = await ytdlpService.download(url, tempDownloadDir, onProgress);

    return {
      filePath: downloadedFilePath,
    };
  }
}
