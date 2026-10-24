import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import type {
  MediaFormat,
  VideoResolution,
  AudioBitrate,
  CompressionPreset,
  AdvancedCompressionOptions,
} from '@mediaflow/shared';

export interface MediaProbeResult {
  format: {
    filename: string;
    format_name: string;
    format_long_name: string;
    duration?: string;
    size?: string;
    bit_rate?: string;
  };
  streams: Array<{
    codec_type: 'video' | 'audio' | string;
    codec_name: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
    duration?: string;
    bit_rate?: string;
    sample_rate?: string;
    channels?: number;
  }>;
}

export interface MediaInfo {
  durationSeconds: number;
  durationFormatted: string;
  width?: number;
  height?: number;
  resolutionLabel?: string;
  sizeBytes: number;
  hasVideo: boolean;
  hasAudio: boolean;
  videoCodec?: string;
  audioCodec?: string;
  availableResolutions: VideoResolution[];
  availableFormats: MediaFormat[];
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]);
    const minutes = parseFloat(parts[1]);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }
  return parseFloat(timeStr) || 0;
}

const RESOLUTION_HEIGHTS: Record<VideoResolution, number> = {
  original: 0,
  '144p': 144,
  '240p': 240,
  '360p': 360,
  '480p': 480,
  '720p': 720,
  '1080p': 1080,
  '1440p': 1440,
  '2160p': 2160,
};

export class FFmpegService {
  /**
   * Run ffprobe to get media details.
   */
  async probe(inputPath: string): Promise<MediaInfo> {
    const args = [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      inputPath,
    ];

    return new Promise((resolve, reject) => {
      const probeProcess = spawn(config.ffprobePath, args);
      let stdout = '';
      let stderr = '';

      probeProcess.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      probeProcess.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      probeProcess.on('close', (code) => {
        if (code !== 0) {
          return reject(
            new Error(`ffprobe failed with exit code ${code}: ${stderr || 'Unknown error'}`)
          );
        }

        try {
          const parsed: MediaProbeResult = JSON.parse(stdout);
          const videoStream = parsed.streams.find((s) => s.codec_type === 'video');
          const audioStream = parsed.streams.find((s) => s.codec_type === 'audio');

          const durationSeconds = parsed.format.duration
            ? parseFloat(parsed.format.duration)
            : videoStream?.duration
              ? parseFloat(videoStream.duration)
              : audioStream?.duration
                ? parseFloat(audioStream.duration)
                : 0;

          const sizeBytes = parsed.format.size
            ? parseInt(parsed.format.size, 10)
            : fs.existsSync(inputPath)
              ? fs.statSync(inputPath).size
              : 0;

          const width = videoStream?.width;
          const height = videoStream?.height;
          const hasVideo = !!videoStream;
          const hasAudio = !!audioStream;

          // Determine available resolutions without upscaling
          const availableResolutions: VideoResolution[] = ['original'];
          if (hasVideo && height) {
            const resolutions: VideoResolution[] = [
              '144p',
              '240p',
              '360p',
              '480p',
              '720p',
              '1080p',
              '1440p',
              '2160p',
            ];
            for (const r of resolutions) {
              if (RESOLUTION_HEIGHTS[r] <= height) {
                availableResolutions.push(r);
              }
            }
          }

          // Determine available formats
          const availableFormats: MediaFormat[] = ['original'];
          if (hasVideo) {
            availableFormats.push('mp4', 'webm');
          }
          if (hasAudio || hasVideo) {
            availableFormats.push('mp3', 'm4a', 'wav', 'aac');
          }

          let resolutionLabel: string | undefined;
          if (width && height) {
            resolutionLabel = `${width}x${height}`;
            if (height >= 2160) resolutionLabel += ' (4K)';
            else if (height >= 1440) resolutionLabel += ' (2K)';
            else if (height >= 1080) resolutionLabel += ' (1080p FHD)';
            else if (height >= 720) resolutionLabel += ' (720p HD)';
            else resolutionLabel += ` (${height}p)`;
          }

          resolve({
            durationSeconds,
            durationFormatted: formatDuration(durationSeconds),
            width,
            height,
            resolutionLabel,
            sizeBytes,
            hasVideo,
            hasAudio,
            videoCodec: videoStream?.codec_name,
            audioCodec: audioStream?.codec_name,
            availableResolutions,
            availableFormats,
          });
        } catch (err: any) {
          reject(new Error(`Failed to parse ffprobe output: ${err.message}`));
        }
      });

      probeProcess.on('error', (err) => {
        reject(new Error(`Failed to spawn ffprobe: ${err.message}`));
      });
    });
  }

  /**
   * Convert or compress media file with progress tracking and abort support.
   */
  convert(options: {
    inputPath: string;
    outputPath: string;
    outputType: 'video' | 'audio' | 'compress';
    targetFormat: MediaFormat;
    targetResolution?: VideoResolution;
    audioBitrate?: AudioBitrate;
    compressionPreset?: CompressionPreset;
    advancedOptions?: AdvancedCompressionOptions;
    totalDurationSeconds: number;
    onProgress: (percent: number) => void;
    signal?: AbortSignal;
  }): Promise<{ outputPath: string; outputSize: number }> {
    return new Promise((resolve, reject) => {
      const {
        inputPath,
        outputPath,
        outputType,
        targetFormat,
        targetResolution,
        audioBitrate,
        compressionPreset,
        advancedOptions,
        totalDurationSeconds,
        onProgress,
        signal,
      } = options;

      const args: string[] = ['-y', '-hide_banner', '-i', inputPath];

      // Audio extraction
      if (outputType === 'audio') {
        args.push('-vn'); // No video

        const bitrate = audioBitrate || '128k';
        switch (targetFormat) {
          case 'mp3':
            args.push('-c:a', 'libmp3lame', '-b:a', bitrate);
            break;
          case 'm4a':
            args.push('-c:a', 'aac', '-b:a', bitrate);
            break;
          case 'wav':
            args.push('-c:a', 'pcm_s16le');
            break;
          case 'aac':
            args.push('-c:a', 'aac', '-b:a', bitrate);
            break;
          default:
            args.push('-c:a', 'libmp3lame', '-b:a', bitrate);
        }
      } else if (outputType === 'compress') {
        // Video compression
        const preset = compressionPreset || 'balanced';

        let crf = 28;
        let vPreset = 'fast';
        let aBitrate = '96k';

        if (preset === 'high') {
          crf = 22;
          vPreset = 'medium';
          aBitrate = '128k';
        } else if (preset === 'small') {
          crf = 34;
          vPreset = 'veryfast';
          aBitrate = '64k';
        }

        // Apply advanced overrides if provided
        if (advancedOptions?.crf !== undefined) crf = advancedOptions.crf;
        if (advancedOptions?.audioBitrate) aBitrate = advancedOptions.audioBitrate;

        // Container / Codec
        const container = advancedOptions?.container || (targetFormat === 'webm' ? 'webm' : 'mp4');
        const codec = advancedOptions?.codec || (container === 'webm' ? 'vp9' : 'h264');

        if (codec === 'vp9') {
          args.push('-c:v', 'libvpx-vp9', '-crf', crf.toString(), '-b:v', advancedOptions?.videoBitrate || '0');
          args.push('-c:a', 'libopus', '-b:a', aBitrate);
        } else {
          args.push('-c:v', 'libx264', '-crf', crf.toString(), '-preset', vPreset, '-pix_fmt', 'yuv420p');
          if (advancedOptions?.videoBitrate) {
            args.push('-b:v', advancedOptions.videoBitrate);
          }
          args.push('-c:a', 'aac', '-b:a', aBitrate);
        }

        if (advancedOptions?.fps) {
          args.push('-r', advancedOptions.fps.toString());
        }

        if (targetResolution && targetResolution !== 'original') {
          const h = RESOLUTION_HEIGHTS[targetResolution];
          if (h > 0) {
            args.push('-vf', `scale=-2:${h}`);
          }
        }
      } else {
        // Video format / resolution conversion
        const targetContainer = targetFormat === 'webm' ? 'webm' : 'mp4';

        if (targetContainer === 'webm') {
          args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0');
          args.push('-c:a', 'libopus');
        } else {
          args.push('-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p');
          args.push('-c:a', 'aac', '-b:a', audioBitrate || '128k');
        }

        if (targetResolution && targetResolution !== 'original') {
          const h = RESOLUTION_HEIGHTS[targetResolution];
          if (h > 0) {
            args.push('-vf', `scale=-2:${h}`);
          }
        }
      }

      // Output progress report via pipe
      args.push('-progress', 'pipe:1', outputPath);

      const ffmpegProcess: ChildProcess = spawn(config.ffmpegPath, args);
      let stderrLog = '';

      if (signal) {
        signal.addEventListener('abort', () => {
          try {
            ffmpegProcess.kill('SIGTERM');
            setTimeout(() => {
              try {
                ffmpegProcess.kill('SIGKILL');
              } catch {}
            }, 1000);
          } catch {}
        });
      }

      ffmpegProcess.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        // Look for out_time_ms or out_time=HH:MM:SS
        const timeMatch = text.match(/out_time_ms=(\d+)/);
        if (timeMatch && totalDurationSeconds > 0) {
          const currentMs = parseInt(timeMatch[1], 10);
          const currentSec = currentMs / 1000000; // FFmpeg reports in microseconds
          const pct = Math.min(99, Math.round((currentSec / totalDurationSeconds) * 100));
          onProgress(pct);
        } else {
          const altMatch = text.match(/out_time=(\d{2}:\d{2}:\d{2}\.\d+)/);
          if (altMatch && totalDurationSeconds > 0) {
            const currentSec = parseTimeToSeconds(altMatch[1]);
            const pct = Math.min(99, Math.round((currentSec / totalDurationSeconds) * 100));
            onProgress(pct);
          }
        }
      });

      ffmpegProcess.stderr?.on('data', (chunk: Buffer) => {
        stderrLog += chunk.toString();
      });

      ffmpegProcess.on('close', (code) => {
        if (signal?.aborted) {
          return reject(new Error('Conversion was cancelled by user'));
        }

        if (code !== 0) {
          return reject(
            new Error(`FFmpeg exited with error code ${code}: ${stderrLog.slice(-500)}`)
          );
        }

        if (!fs.existsSync(outputPath)) {
          return reject(new Error('FFmpeg completed but output file was not created'));
        }

        const stats = fs.statSync(outputPath);
        onProgress(100);
        resolve({ outputPath, outputSize: stats.size });
      });

      ffmpegProcess.on('error', (err) => {
        reject(new Error(`Failed to start FFmpeg: ${err.message}`));
      });
    });
  }
}

export const ffmpegService = new FFmpegService();
