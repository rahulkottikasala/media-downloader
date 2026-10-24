export type MediaPlatform =
  | 'direct'
  | 'local'
  | 'youtube'
  | 'instagram'
  | 'terabox'
  | 'webvideo'
  | 'unknown';

export type MediaFormat = 'original' | 'mp4' | 'webm' | 'mp3' | 'm4a' | 'wav' | 'aac';

export type VideoResolution =
  | 'original'
  | '144p'
  | '240p'
  | '360p'
  | '480p'
  | '720p'
  | '1080p'
  | '1440p'
  | '2160p';

export type AudioBitrate = '64k' | '96k' | '128k' | '192k' | '256k' | '320k';

export type CompressionPreset = 'high' | 'balanced' | 'small';

export interface AdvancedCompressionOptions {
  crf?: number;
  videoBitrate?: string;
  audioBitrate?: string;
  fps?: number;
  codec?: 'h264' | 'vp9';
  container?: 'mp4' | 'webm';
}

export type JobStatus =
  | 'queued'
  | 'fetching'
  | 'converting'
  | 'compressing'
  | 'ready'
  | 'downloading'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface MediaMetadata {
  supported: boolean;
  platform: MediaPlatform;
  title: string;
  duration?: number; // seconds
  durationFormatted?: string;
  sourceUrl?: string;
  uploadId?: string;
  thumbnail?: string;
  previewUrl?: string;
  embedUrl?: string;
  width?: number;
  height?: number;
  resolutionLabel?: string;
  sizeBytes?: number;
  sizeFormatted?: string;
  mimeType?: string;
  hasVideo: boolean;
  hasAudio: boolean;
  availableResolutions: VideoResolution[];
  availableFormats: MediaFormat[];
  isPlaylist?: boolean;
  playlistCount?: number;
  playlistEntries?: Array<{
    id: string;
    title: string;
    duration?: number;
    durationFormatted?: string;
    url: string;
    thumbnail?: string;
  previewUrl?: string;
  embedUrl?: string;
  }>;
  message?: string;
  error?: string;
}

export interface CreateJobInput {
  url?: string;
  uploadId?: string;
  outputType: 'video' | 'audio' | 'compress';
  targetFormat: MediaFormat;
  targetResolution?: VideoResolution;
  audioBitrate?: AudioBitrate;
  customFilename?: string;
  compressionPreset?: CompressionPreset;
  advancedOptions?: AdvancedCompressionOptions;
}

export interface JobState {
  id: string;
  accessToken: string;
  status: JobStatus;
  progress: number;
  stage: string;
  message?: string;
  outputFilename?: string;
  outputFilePath?: string;
  outputMimeType?: string;
  outputSize?: number;
  originalSize?: number;
  compressionRatio?: number;
  error?: string;
  createdAt: number;
  completedAt?: number;
  downloadCount: number;
  hasActiveDownloadStream?: boolean;
}

export interface JobPublicDto {
  id: string;
  accessToken: string;
  status: JobStatus;
  progress: number;
  stage: string;
  message?: string;
  outputFilename?: string;
  outputSize?: number;
  originalSize?: number;
  compressionRatio?: number;
  durationSeconds?: number;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface JobProgressEvent {
  jobId: string;
  status: JobStatus;
  progress: number;
  stage: string;
  message?: string;
  outputSize?: number;
  originalSize?: number;
  error?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptimeSeconds: number;
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  ffmpegVersion?: string;
  activeJobs: number;
  queuedJobs: number;
}
