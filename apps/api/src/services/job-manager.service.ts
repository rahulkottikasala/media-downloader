import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { config } from '../config.js';
import { ffmpegService } from './ffmpeg.service.js';
import { providerRegistry } from '../providers/provider.registry.js';
import { validateSafeUrl } from './ssrf.service.js';
import type {
  CreateJobInput,
  JobState,
  JobPublicDto,
  JobProgressEvent,
} from '@mediaflow/shared';

interface InternalJob extends JobState {
  input: CreateJobInput;
  abortController?: AbortController;
  tempJobDir: string;
}

export class JobManagerService {
  private jobs = new Map<string, InternalJob>();
  private queue: string[] = [];
  private activeJobsCount = 0;
  private emitter = new EventEmitter();

  constructor() {
    // Increase event emitter max listeners for SSE
    this.emitter.setMaxListeners(100);

    // Initial startup cleanup
    this.cleanupOldTempDirs();

    // Periodic sweep every 5 minutes
    setInterval(() => {
      this.sweepExpiredJobs();
    }, 5 * 60 * 1000).unref();
  }

  private cleanupOldTempDirs() {
    try {
      if (fs.existsSync(config.tempDir)) {
        const entries = fs.readdirSync(config.tempDir);
        for (const entry of entries) {
          if (entry === 'probes') continue;
          const fullPath = path.join(config.tempDir, entry);
          try {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } catch {}
        }
      }
    } catch {}
  }

  private sweepExpiredJobs() {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (now - job.createdAt > config.jobRetentionMs) {
        if (!job.hasActiveDownloadStream) {
          this.removeJob(id);
        }
      }
    }
  }

  /**
   * Create a new job and push to queue.
   */
  async createJob(input: CreateJobInput): Promise<JobPublicDto> {
    const id = crypto.randomUUID();
    const accessToken = crypto.randomBytes(24).toString('hex');
    const tempJobDir = path.join(config.tempDir, id);

    fs.mkdirSync(tempJobDir, { recursive: true });

    const job: InternalJob = {
      id,
      accessToken,
      status: 'queued',
      progress: 0,
      stage: 'Job Queued',
      message: 'Waiting in queue for processing worker...',
      createdAt: Date.now(),
      downloadCount: 0,
      input,
      tempJobDir,
    };

    this.jobs.set(id, job);
    this.queue.push(id);
    this.processNext();

    return this.toPublicDto(job);
  }

  getJob(id: string): InternalJob | undefined {
    return this.jobs.get(id);
  }

  getJobPublic(id: string, accessToken?: string): JobPublicDto | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (accessToken && job.accessToken !== accessToken) return null;
    return this.toPublicDto(job);
  }

  toPublicDto(job: InternalJob): JobPublicDto {
    const durationSeconds = job.completedAt
      ? Math.round((job.completedAt - job.createdAt) / 1000)
      : Math.round((Date.now() - job.createdAt) / 1000);

    return {
      id: job.id,
      accessToken: job.accessToken,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      message: job.message,
      outputFilename: job.outputFilename,
      outputSize: job.outputSize,
      originalSize: job.originalSize,
      compressionRatio: job.compressionRatio,
      durationSeconds,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    };
  }

  subscribeEvents(id: string, listener: (event: JobProgressEvent) => void): () => void {
    const eventName = `job:${id}`;
    this.emitter.on(eventName, listener);
    return () => {
      this.emitter.off(eventName, listener);
    };
  }

  private emitUpdate(job: InternalJob) {
    const event: JobProgressEvent = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      stage: job.stage,
      message: job.message,
      outputSize: job.outputSize,
      originalSize: job.originalSize,
      error: job.error,
    };
    this.emitter.emit(`job:${job.id}`, event);
  }

  cancelJob(id: string, accessToken?: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (accessToken && job.accessToken !== accessToken) return false;

    if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') {
      return false;
    }

    if (job.abortController) {
      job.abortController.abort();
    }

    const wasActive = job.status !== 'queued';
    job.status = 'cancelled';
    job.stage = 'Cancelled';
    job.message = 'Job was cancelled by the user.';
    job.completedAt = Date.now();
    this.emitUpdate(job);

    // Clean temp job directory
    try {
      if (fs.existsSync(job.tempJobDir)) {
        fs.rmSync(job.tempJobDir, { recursive: true, force: true });
      }
    } catch {}

    // Free concurrency slot
    if (wasActive) {
      this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
    }
    this.processNext();
    return true;
  }

  removeJob(id: string) {
    const job = this.jobs.get(id);
    if (job) {
      if (job.abortController) {
        job.abortController.abort();
      }
      try {
        if (fs.existsSync(job.tempJobDir)) {
          fs.rmSync(job.tempJobDir, { recursive: true, force: true });
        }
      } catch {}
      this.jobs.delete(id);
    }
  }

  private async processNext(): Promise<void> {
    if (this.activeJobsCount >= config.maxConcurrentJobs) {
      return;
    }
    const nextJobId = this.queue.shift();
    if (!nextJobId) {
      return;
    }

    const job = this.jobs.get(nextJobId);
    if (!job || job.status === 'cancelled') {
      return this.processNext();
    }

    this.activeJobsCount++;
    this.executeJob(job).finally(() => {
      this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
      this.processNext();
    });
  }

  private async executeJob(job: InternalJob) {
    job.abortController = new AbortController();
    const signal = job.abortController.signal;

    try {
      let sourceFilePath = '';
      let isSourceTemp = false;

      // Stage 1: Resolve input media
      if (job.input.uploadId) {
        job.stage = 'Fetching';
        job.status = 'fetching';
        job.progress = 10;
        job.message = 'Loading local uploaded media...';
        this.emitUpdate(job);

        const localProvider = providerRegistry.findProvider('local://');
        if (!localProvider) throw new Error('Local provider not found');
        const resolved = await localProvider.resolveAuthorizedSource(job.input.uploadId);
        if (!resolved.filePath || !fs.existsSync(resolved.filePath)) {
          throw new Error('Uploaded source file is missing');
        }
        sourceFilePath = resolved.filePath;
      } else if (job.input.url) {
        job.stage = 'Fetching';
        job.status = 'fetching';
        job.progress = 5;
        job.message = 'Connecting to media stream...';
        this.emitUpdate(job);

        const provider = providerRegistry.findProvider(job.input.url);
        if (!provider) {
          throw new Error('No provider available to handle this URL');
        }

        const safeCheck = await validateSafeUrl(job.input.url);
        if (!safeCheck.valid) {
          throw new Error(safeCheck.error || 'Blocked by security validation');
        }

        const resolved = await provider.resolveAuthorizedSource(job.input.url, job.input.targetFormat);

        if (resolved.filePath) {
          sourceFilePath = resolved.filePath;
          isSourceTemp = true;
        } else if (resolved.streamUrl) {
          // Download source to temp job dir
          const downloadedSource = path.join(job.tempJobDir, 'source-media');
          const fileWriteStream = fs.createWriteStream(downloadedSource);

          const response = await fetch(resolved.streamUrl, {
            signal,
            headers: {
              'User-Agent': 'MediaFlow-Bot/1.0',
              ...(resolved.headers || {}),
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch media stream: ${response.status} ${response.statusText}`);
          }

          const totalContentLength = parseInt(response.headers.get('content-length') || '0', 10);
          let downloadedBytes = 0;

          if (!response.body) {
            throw new Error('Response body stream is empty');
          }

          // @ts-ignore
          const reader = response.body.getReader();
          while (true) {
            if (signal.aborted) throw new Error('Job cancelled');
            const { done, value } = await reader.read();
            if (done) break;
            downloadedBytes += value.length;
            fileWriteStream.write(value);

            if (totalContentLength > 0) {
              const fetchPct = Math.min(25, Math.round((downloadedBytes / totalContentLength) * 20) + 5);
              job.progress = fetchPct;
              job.message = `Downloaded ${formatBytes(downloadedBytes)} of ${formatBytes(totalContentLength)}...`;
              this.emitUpdate(job);
            }
          }

          await new Promise<void>((resolve) => fileWriteStream.end(resolve));
          sourceFilePath = downloadedSource;
          isSourceTemp = true;
        } else {
          throw new Error('Could not resolve media source');
        }
      }

      if (signal.aborted) throw new Error('Job cancelled');

      // Probe source media
      const probeInfo = await ffmpegService.probe(sourceFilePath);
      const originalSize = fs.existsSync(sourceFilePath) ? fs.statSync(sourceFilePath).size : probeInfo.sizeBytes;
      job.originalSize = originalSize;

      // Determine output extension and filename
      const targetFormat = job.input.targetFormat;
      const extension = targetFormat === 'original'
        ? (probeInfo.hasVideo ? 'mp4' : 'mp3')
        : targetFormat;

      const safeBaseName = job.input.customFilename
        ? sanitizeFilename(job.input.customFilename)
        : `mediaflow-${job.id.slice(0, 8)}`;

      const outputFilename = `${safeBaseName}.${extension}`;
      const outputFilePath = path.join(job.tempJobDir, outputFilename);

      // Check if conversion is required or direct copy
      const isCompress = job.input.outputType === 'compress';
      const isAudioExtraction = job.input.outputType === 'audio';
      const needsTranscode =
        isCompress ||
        isAudioExtraction ||
        (job.input.targetResolution && job.input.targetResolution !== 'original') ||
        (targetFormat !== 'original');

      job.stage = isCompress ? 'Compressing' : 'Converting';
      job.status = isCompress ? 'compressing' : 'converting';
      job.progress = 25;
      job.message = isCompress ? 'Compressing media stream...' : 'Transcoding media...';
      this.emitUpdate(job);

      if (needsTranscode) {
        await ffmpegService.convert({
          inputPath: sourceFilePath,
          outputPath: outputFilePath,
          outputType: job.input.outputType,
          targetFormat: job.input.targetFormat,
          targetResolution: job.input.targetResolution,
          audioBitrate: job.input.audioBitrate,
          compressionPreset: job.input.compressionPreset,
          advancedOptions: job.input.advancedOptions,
          totalDurationSeconds: probeInfo.durationSeconds,
          signal,
          onProgress: (pct) => {
            // Map 0-100% ffmpeg progress to 25-95% overall job progress
            job.progress = Math.min(95, 25 + Math.round((pct * 70) / 100));
            job.message = `${job.stage} in progress: ${pct}%`;
            this.emitUpdate(job);
          },
        });
      } else {
        // Direct copy
        fs.copyFileSync(sourceFilePath, outputFilePath);
      }

      if (signal.aborted) throw new Error('Job cancelled');

      // Final stats
      const outputStats = fs.statSync(outputFilePath);
      const outputSize = outputStats.size;
      const compressionRatio = originalSize > 0
        ? Math.round(((originalSize - outputSize) / originalSize) * 100)
        : 0;

      job.status = 'ready';
      job.stage = 'Ready';
      job.progress = 100;
      job.outputFilename = outputFilename;
      job.outputFilePath = outputFilePath;
      job.outputSize = outputSize;
      job.compressionRatio = compressionRatio;
      job.completedAt = Date.now();
      job.message = `Processing complete. Output file is ready (${formatBytes(outputSize)}).`;
      this.emitUpdate(job);

      // If source was a temporary download, remove it now to free disk space
      if (isSourceTemp && fs.existsSync(sourceFilePath)) {
        try {
          fs.unlinkSync(sourceFilePath);
        } catch {}
      }
    } catch (err: any) {
      if (job.status === 'cancelled') return;

      job.status = 'failed';
      job.stage = 'Failed';
      job.error = err.message || 'Processing failed';
      job.message = `Failed: ${job.error}`;
      job.completedAt = Date.now();
      this.emitUpdate(job);

      // Clean temp folder on failure
      try {
        if (fs.existsSync(job.tempJobDir)) {
          fs.rmSync(job.tempJobDir, { recursive: true, force: true });
        }
      } catch {}
    }
  }

  getMetrics() {
    return {
      activeJobs: this.activeJobsCount,
      queuedJobs: this.queue.length,
      totalTracked: this.jobs.size,
    };
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-.]/g, '_').slice(0, 80);
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

export const jobManagerService = new JobManagerService();
