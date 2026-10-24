import fs from 'fs';
import path from 'path';
import { MediaProvider, MediaSourceResolution } from './types.js';
import type { MediaFormat, MediaMetadata } from '@mediaflow/shared';
import { ffmpegService } from '../services/ffmpeg.service.js';
import { config } from '../config.js';

export class LocalFileProvider implements MediaProvider {
  name = 'local';

  canHandle(urlOrId: string): boolean {
    return (
      urlOrId.startsWith('local://') ||
      urlOrId.startsWith('upload:') ||
      !urlOrId.includes('://')
    );
  }

  async inspect(uploadId: string): Promise<MediaMetadata> {
    const cleanId = uploadId.replace(/^(local:\/\/|upload:)/, '');
    const metaPath = path.join(config.uploadDir, `${cleanId}.json`);
    const filePath = path.join(config.uploadDir, cleanId);

    if (!fs.existsSync(filePath)) {
      return {
        supported: false,
        platform: 'local',
        title: 'File Not Found',
        uploadId: cleanId,
        hasVideo: false,
        hasAudio: false,
        availableResolutions: ['original'],
        availableFormats: ['original'],
        error: `Uploaded file was not found or has expired.`,
      };
    }

    let originalName = 'uploaded-file';
    let mimeType = 'application/octet-stream';

    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        originalName = meta.originalName || originalName;
        mimeType = meta.mimeType || mimeType;
      } catch {}
    }

    try {
      const probeInfo = await ffmpegService.probe(filePath);
      return {
        supported: true,
        platform: 'local',
        title: originalName,
        duration: probeInfo.durationSeconds,
        durationFormatted: probeInfo.durationFormatted,
        uploadId: cleanId,
        previewUrl: `/api/media/stream/${cleanId}`,
        width: probeInfo.width,
        height: probeInfo.height,
        resolutionLabel: probeInfo.resolutionLabel,
        sizeBytes: probeInfo.sizeBytes,
        sizeFormatted: formatBytes(probeInfo.sizeBytes),
        mimeType,
        hasVideo: probeInfo.hasVideo,
        hasAudio: probeInfo.hasAudio,
        availableResolutions: probeInfo.availableResolutions,
        availableFormats: probeInfo.availableFormats,
      };
    } catch (err: any) {
      return {
        supported: false,
        platform: 'local',
        title: originalName,
        uploadId: cleanId,
        hasVideo: false,
        hasAudio: false,
        availableResolutions: ['original'],
        availableFormats: ['original'],
        error: `Failed to inspect local file: ${err.message}`,
      };
    }
  }

  async getFormats(uploadId: string): Promise<MediaFormat[]> {
    const meta = await this.inspect(uploadId);
    return meta.availableFormats;
  }

  async resolveAuthorizedSource(uploadId: string): Promise<MediaSourceResolution> {
    const cleanId = uploadId.replace(/^(local:\/\/|upload:)/, '');
    const filePath = path.join(config.uploadDir, cleanId);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Uploaded file "${cleanId}" does not exist`);
    }

    return {
      filePath,
    };
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(1)} ${units[i]}`;
}
