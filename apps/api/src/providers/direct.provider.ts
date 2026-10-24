import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { MediaProvider, MediaSourceResolution } from './types.js';
import type { MediaFormat, MediaMetadata } from '@mediaflow/shared';
import { validateSafeUrl } from '../services/ssrf.service.js';
import { ffmpegService } from '../services/ffmpeg.service.js';
import { config } from '../config.js';

const KNOWN_EXTENSIONS = ['.mp4', '.webm', '.mkv', '.mov', '.mp3', '.m4a', '.wav', '.aac', '.ogg', '.flac'];

export class DirectMediaProvider implements MediaProvider {
  name = 'direct';

  canHandle(url: string): boolean {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }
      const host = parsed.hostname.toLowerCase();
      if (host.includes('youtube.com') || host.includes('youtu.be') || host.includes('instagram.com')) {
        return false;
      }
      const pathname = parsed.pathname.toLowerCase();
      // If extension matches
      if (KNOWN_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
        return true;
      }
      // If content-type / media query hints exist
      if (parsed.searchParams.has('format') || pathname.includes('/video/') || pathname.includes('/audio/')) {
        return true;
      }
      return true;
    } catch {
      return false;
    }
  }

  async inspect(url: string): Promise<MediaMetadata> {
    const safeCheck = await validateSafeUrl(url);
    if (!safeCheck.valid) {
      return {
        supported: false,
        platform: 'direct',
        title: 'Security Exception',
        hasVideo: false,
        hasAudio: false,
        availableResolutions: ['original'],
        availableFormats: ['original'],
        error: safeCheck.error || 'Blocked by SSRF protection',
      };
    }

    try {
      // Fetch headers first
      const headRes = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual',
        headers: {
          'User-Agent': 'MediaFlow-Bot/1.0',
        },
      });

      // Handle redirect safely
      let effectiveUrl = url;
      if (headRes.status >= 300 && headRes.status < 400) {
        const location = headRes.headers.get('location');
        if (!location) {
          throw new Error('Redirect returned without Location header');
        }
        const resolvedRedirect = new URL(location, url).toString();
        const redirectCheck = await validateSafeUrl(resolvedRedirect);
        if (!redirectCheck.valid) {
          throw new Error(`Redirect target unsafe: ${redirectCheck.error}`);
        }
        effectiveUrl = resolvedRedirect;
      }

      // Safe stream initial chunk to a probe file in temp directory
      const tempProbeDir = path.join(config.tempDir, 'probes');
      if (!fs.existsSync(tempProbeDir)) {
        fs.mkdirSync(tempProbeDir, { recursive: true });
      }
      const probeFilePath = path.join(tempProbeDir, `probe-${crypto.randomUUID()}`);

      const response = await fetch(effectiveUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'MediaFlow-Bot/1.0',
          Range: 'bytes=0-20971520', // Read up to 20MB for metadata inspection
        },
      });

      if (!response.ok && response.status !== 206) {
        throw new Error(`Server returned HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const contentDisposition = response.headers.get('content-disposition') || '';
      const contentLength = response.headers.get('content-length');

      // Extract filename from disposition or URL
      let filename = 'downloaded-media';
      const dispositionMatch = contentDisposition.match(/filename=["']?([^"';]+)["']?/i);
      if (dispositionMatch) {
        filename = dispositionMatch[1];
      } else {
        const urlPath = new URL(effectiveUrl).pathname;
        const base = path.basename(urlPath);
        if (base && base.length > 2) {
          filename = base;
        }
      }

      // Write chunk to probe file
      const arrayBuffer = await response.arrayBuffer();
      fs.writeFileSync(probeFilePath, Buffer.from(arrayBuffer));

      // Run ffprobe on probe file
      const probeInfo = await ffmpegService.probe(probeFilePath);

      // Clean probe file
      try {
        if (fs.existsSync(probeFilePath)) {
          fs.unlinkSync(probeFilePath);
        }
      } catch {}

      const totalSize = contentLength ? parseInt(contentLength, 10) : probeInfo.sizeBytes;

      return {
        supported: true,
        platform: 'direct',
        title: filename,
        duration: probeInfo.durationSeconds,
        durationFormatted: probeInfo.durationFormatted,
        sourceUrl: effectiveUrl,
        width: probeInfo.width,
        height: probeInfo.height,
        resolutionLabel: probeInfo.resolutionLabel,
        sizeBytes: totalSize,
        sizeFormatted: formatBytes(totalSize),
        mimeType: contentType || (probeInfo.hasVideo ? 'video/mp4' : 'audio/mpeg'),
        hasVideo: probeInfo.hasVideo,
        hasAudio: probeInfo.hasAudio,
        availableResolutions: probeInfo.availableResolutions,
        availableFormats: probeInfo.availableFormats,
      };
    } catch (err: any) {
      return {
        supported: false,
        platform: 'direct',
        title: 'Inspection Failed',
        hasVideo: false,
        hasAudio: false,
        availableResolutions: ['original'],
        availableFormats: ['original'],
        error: `Could not inspect direct media URL: ${err.message}`,
      };
    }
  }

  async getFormats(url: string): Promise<MediaFormat[]> {
    const meta = await this.inspect(url);
    return meta.availableFormats;
  }

  async resolveAuthorizedSource(url: string): Promise<MediaSourceResolution> {
    const safeCheck = await validateSafeUrl(url);
    if (!safeCheck.valid) {
      throw new Error(safeCheck.error || 'Blocked by SSRF protection');
    }
    return {
      streamUrl: url,
    };
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}
