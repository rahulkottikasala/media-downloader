import { z } from 'zod';

export const MediaFormatSchema = z.enum([
  'original',
  'mp4',
  'webm',
  'mp3',
  'm4a',
  'wav',
  'aac',
]);

export const VideoResolutionSchema = z.enum([
  'original',
  '144p',
  '240p',
  '360p',
  '480p',
  '720p',
  '1080p',
  '1440p',
  '2160p',
]);

export const AudioBitrateSchema = z.enum([
  '64k',
  '96k',
  '128k',
  '192k',
  '256k',
  '320k',
]);

export const CompressionPresetSchema = z.enum(['high', 'balanced', 'small']);

export const AdvancedCompressionOptionsSchema = z.object({
  crf: z.number().min(0).max(51).optional(),
  videoBitrate: z.string().regex(/^\d+(k|M)$/).optional(),
  audioBitrate: z.string().regex(/^\d+(k|M)$/).optional(),
  fps: z.number().min(1).max(120).optional(),
  codec: z.enum(['h264', 'vp9']).optional(),
  container: z.enum(['mp4', 'webm']).optional(),
});

export const InspectMediaSchema = z.object({
  url: z.string().url().max(2048),
});

export const CreateJobSchema = z.object({
  url: z.string().url().max(2048).optional(),
  uploadId: z.string().min(1).max(256).optional(),
  outputType: z.enum(['video', 'audio', 'compress']),
  targetFormat: MediaFormatSchema,
  targetResolution: VideoResolutionSchema.optional().default('original'),
  audioBitrate: AudioBitrateSchema.optional().default('128k'),
  customFilename: z
    .string()
    .max(100)
    .regex(/^[a-zA-Z0-9_\-.\s]*$/, 'Invalid filename characters')
    .optional(),
  compressionPreset: CompressionPresetSchema.optional().default('balanced'),
  advancedOptions: AdvancedCompressionOptionsSchema.optional(),
}).refine((data) => data.url || data.uploadId, {
  message: 'Either url or uploadId must be provided',
});

export type InspectMediaInput = z.infer<typeof InspectMediaSchema>;
