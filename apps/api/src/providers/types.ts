import type { MediaFormat, MediaMetadata } from '@mediaflow/shared';

export interface MediaSourceResolution {
  streamUrl?: string;
  filePath?: string;
  headers?: Record<string, string>;
  title?: string;
  sizeBytes?: number;
  durationSeconds?: number;
}

export interface MediaProvider {
  name: string;
  canHandle(url: string): boolean;
  inspect(url: string): Promise<MediaMetadata>;
  getFormats(url: string): Promise<MediaFormat[]>;
  resolveAuthorizedSource(url: string, format?: MediaFormat): Promise<MediaSourceResolution>;
}
