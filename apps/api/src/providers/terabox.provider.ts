import { MediaProvider, MediaSourceResolution } from './types.js';
import type { MediaFormat, MediaMetadata, VideoResolution } from '@mediaflow/shared';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { config } from '../config.js';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

interface TeraboxFileInfo {
  fileName: string;
  fileSize?: string;
  sizeBytes?: number;
  downloadUrl?: string;
  thumbnail?: string;
  isVideo?: boolean;
}

export class TeraboxProvider implements MediaProvider {
  name = 'terabox';

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }
      const host = parsed.hostname.toLowerCase();
      const isDomain =
        host.includes('terabox') ||
        host.includes('1024tera') ||
        host.includes('terasharelink') ||
        host.includes('freeterabox') ||
        host.includes('4funbox') ||
        host.includes('mirrobox') ||
        host.includes('nephobox') ||
        host.includes('momerybox') ||
        host.includes('tibibox');

      const isSharePath =
        parsed.pathname.includes('/s/') ||
        parsed.pathname.includes('/share/') ||
        parsed.pathname.includes('/sharing/link') ||
        parsed.searchParams.has('surl');

      return isDomain || isSharePath;
    } catch {
      return false;
    }
  }

  private extractShareId(url: string): string | null {
    const patterns = [
      /\/s\/([a-zA-Z0-9_-]+)/,
      /\/share\/([a-zA-Z0-9_-]+)/,
      /[?&]surl=([a-zA-Z0-9_-]+)/i,
      /[?&]shareid=([a-zA-Z0-9_-]+)/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  private async fetchPageInfo(url: string): Promise<TeraboxFileInfo> {
    const shareId = this.extractShareId(url);
    const parsed = new URL(url);
    const domain = parsed.hostname || 'www.terabox.com';
    const targetUrl = shareId ? `https://${domain}/s/${shareId}` : url;

    const cookie = process.env.TERABOX_COOKIE || '';
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: `https://${domain}/`,
    };

    if (cookie) {
      headers['Cookie'] = cookie;
    }

    const res = await fetch(targetUrl, {
      headers,
      redirect: 'follow',
    });

    const html = await res.text();

    // Extract title / fileName
    let fileName = '';
    const ogTitle = html.match(/property="og:title"\s+content="([^"]+)"/i) || html.match(/name="title"\s+content="([^"]+)"/i);
    if (ogTitle && ogTitle[1]) {
      fileName = ogTitle[1];
    } else {
      const titleTag = html.match(/<title>([^<]+)<\/title>/i);
      if (titleTag && titleTag[1]) {
        fileName = titleTag[1];
      }
    }

    // Clean title
    if (fileName) {
      fileName = fileName
        .replace(/\s*-\s*Share Files Online.*$/i, '')
        .replace(/\s*-\s*TeraBox.*$/i, '')
        .replace(/\s*-\s*Terabox.*$/i, '')
        .trim();
    }

    if (!fileName) {
      const nameMatch = html.match(/"server_filename":\s*"([^"]+)"/i) || html.match(/"filename":\s*"([^"]+)"/i);
      if (nameMatch && nameMatch[1]) {
        fileName = nameMatch[1];
      }
    }

    // Extract thumbnail
    let thumbnail = '';
    const ogImg = html.match(/property="og:image"\s+content="([^"]+)"/i);
    if (ogImg && ogImg[1]) {
      thumbnail = ogImg[1];
    } else {
      const thumbMatch = html.match(/"thumbs":\s*\{[^}]*"url3":\s*"([^"]+)"/i);
      if (thumbMatch && thumbMatch[1]) {
        thumbnail = thumbMatch[1].replace(/\\/g, '');
      }
    }

    // Extract file size
    let fileSize = '';
    let sizeBytes = 0;
    const sizeMatch = html.match(/"size":\s*"(\d+)"/i) || html.match(/"file_size":\s*"(\d+)"/i);
    if (sizeMatch && sizeMatch[1]) {
      sizeBytes = parseInt(sizeMatch[1], 10);
      fileSize = formatBytes(sizeBytes);
    } else {
      const humanSize = html.match(/(\d+\.?\d*)\s*(KB|MB|GB|TB)/i);
      if (humanSize && humanSize[0]) {
        fileSize = humanSize[0];
      }
    }

    // Extract direct download link / dlink
    let downloadUrl = '';
    const dlinkMatch =
      html.match(/"dlink":\s*"([^"]+)"/i) ||
      html.match(/"downloadUrl":\s*"([^"]+)"/i) ||
      html.match(/"download_url":\s*"([^"]+)"/i);

    if (dlinkMatch && dlinkMatch[1]) {
      downloadUrl = dlinkMatch[1].replace(/\\/g, '');
    }

    const isVideo =
      fileName.endsWith('.mp4') ||
      fileName.endsWith('.mkv') ||
      fileName.endsWith('.mov') ||
      fileName.endsWith('.avi') ||
      fileName.endsWith('.webm') ||
      html.includes('video/mp4') ||
      html.includes('video_player');

    return {
      fileName: fileName || 'TeraBox Media',
      fileSize,
      sizeBytes,
      downloadUrl,
      thumbnail,
      isVideo,
    };
  }

  async inspect(url: string): Promise<MediaMetadata> {
    try {
      const info = await this.fetchPageInfo(url);

      return {
        supported: true,
        platform: 'terabox',
        title: info.fileName,
        thumbnail: info.thumbnail,
        sourceUrl: url,
        hasVideo: info.isVideo ?? true,
        hasAudio: true,
        sizeBytes: info.sizeBytes,
        sizeFormatted: info.fileSize,
        availableResolutions: ['original', '1080p', '720p', '480p', '360p'],
        availableFormats: ['original', 'mp4', 'webm', 'mp3', 'm4a', 'wav'],
      };
    } catch (err: any) {
      console.error('TeraBox inspect error:', err);
      const shareId = this.extractShareId(url);
      return {
        supported: false,
        platform: 'terabox',
        title: shareId ? `TeraBox File (${shareId})` : 'TeraBox File Detected',
        hasVideo: false,
        hasAudio: false,
        availableResolutions: ['original'],
        availableFormats: ['original'],
        message:
          'TeraBox link detected. To download restricted or private files, configure TERABOX_COOKIE in environment settings.',
      };
    }
  }

  async getFormats(_url: string): Promise<MediaFormat[]> {
    return ['original', 'mp4', 'webm', 'mp3', 'm4a', 'wav'];
  }

  async resolveAuthorizedSource(url: string): Promise<MediaSourceResolution> {
    const info = await this.fetchPageInfo(url);

    if (!info.downloadUrl) {
      throw new Error(
        'Direct download link could not be generated for this TeraBox link. It may require a login cookie or be private.'
      );
    }

    const tempDownloadDir = path.join(config.tempDir, `tera-${crypto.randomUUID()}`);
    fs.mkdirSync(tempDownloadDir, { recursive: true });

    const safeExt = path.extname(info.fileName) || '.mp4';
    const tempFilePath = path.join(tempDownloadDir, `source${safeExt}`);

    const res = await fetch(info.downloadUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        Referer: 'https://www.terabox.com/',
      },
    });

    if (!res.ok || !res.body) {
      throw new Error(`Failed to fetch TeraBox download stream: HTTP ${res.status}`);
    }

    const fileStream = fs.createWriteStream(tempFilePath);
    // @ts-ignore
    await pipeline(res.body, fileStream);

    return {
      filePath: tempFilePath,
    };
  }
}
