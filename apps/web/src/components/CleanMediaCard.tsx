import React, { useState, useEffect } from 'react';
import {
  Download,
  Film,
  Zap,
  Music,
  Smartphone,
  Loader2,
  CheckCircle2,
  Clock,
  HardDrive,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MediaMetadata, CreateJobInput, JobPublicDto, JobProgressEvent } from '@mediaflow/shared';
import { createJob, getDownloadUrl, getApiBaseUrl } from '../api';
import { InteractiveMediaPlayer } from './InteractiveMediaPlayer';

interface CleanMediaCardProps {
  metadata: MediaMetadata;
  onReset: () => void;
}

function getPlatformLabel(platform: string): string {
  switch (platform) {
    case 'youtube':
      return 'YouTube';
    case 'instagram':
      return 'Instagram';
    case 'terabox':
      return 'TeraBox';
    case 'webvideo':
      return 'Web Video';
    case 'direct':
      return 'Direct Video';
    case 'local':
      return 'Uploaded File';
    default:
      return 'Media';
  }
}

export const CleanMediaCard: React.FC<CleanMediaCardProps> = ({ metadata, onReset }) => {
  const [activeJob, setActiveJob] = useState<JobPublicDto | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  // Subscribe to SSE updates when a job is active, with polling fallback
  useEffect(() => {
    if (!activeJob || activeJob.status === 'completed' || activeJob.status === 'failed') {
      return;
    }

    let isSubscribed = true;

    // Helper to handle terminal states & auto-download
    const handleJobState = (job: JobPublicDto | JobProgressEvent) => {
      setActiveJob((prev) => (prev ? { ...prev, ...job } : null));

      if (job.status === 'ready' || job.status === 'completed') {
        setIsProcessing(false);
        const downloadLink = document.createElement('a');
        downloadLink.href = getDownloadUrl(activeJob.id, activeJob.accessToken);
        downloadLink.download =
          (job as any).outputFilename || activeJob.outputFilename || 'mediaflow-video';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        downloadLink.remove();
      } else if (job.status === 'failed' || job.status === 'cancelled') {
        setIsProcessing(false);
      }
    };

    // 1. EventSource connection
    const eventSource = new EventSource(
      `${getApiBaseUrl()}/jobs/${activeJob.id}/events?token=${encodeURIComponent(activeJob.accessToken)}`
    );

    eventSource.onmessage = (e) => {
      if (!isSubscribed) return;
      try {
        const data: JobProgressEvent = JSON.parse(e.data);
        handleJobState(data);
        if (data.status === 'ready' || data.status === 'completed' || data.status === 'failed') {
          eventSource.close();
        }
      } catch {}
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    // 2. Resilient Polling Fallback every 2 seconds
    const pollInterval = setInterval(async () => {
      if (!isSubscribed) return;
      try {
        const res = await fetch(
          `${getApiBaseUrl()}/jobs/${activeJob.id}?token=${encodeURIComponent(activeJob.accessToken)}`
        );
        if (res.ok) {
          const jobData: JobPublicDto = await res.json();
          handleJobState(jobData);
          if (
            jobData.status === 'ready' ||
            jobData.status === 'completed' ||
            jobData.status === 'failed'
          ) {
            clearInterval(pollInterval);
            eventSource.close();
          }
        }
      } catch {}
    }, 2000);

    return () => {
      isSubscribed = false;
      eventSource.close();
      clearInterval(pollInterval);
    };
  }, [activeJob?.id, activeJob?.accessToken]);

  const handleStartVariant = async (
    variantKey: string,
    outputType: 'video' | 'audio' | 'compress',
    targetFormat: 'mp4' | 'mp3',
    compressionPreset?: 'balanced' | 'high' | 'small',
    targetResolution?: '720p' | '480p' | 'original'
  ) => {
    setSelectedVariant(variantKey);
    setIsProcessing(true);

    try {
      const input: CreateJobInput = {
        url: metadata.sourceUrl,
        uploadId: metadata.uploadId,
        outputType,
        targetFormat,
        compressionPreset,
        targetResolution,
      };

      const job = await createJob(input);
      setActiveJob(job);
    } catch (err: any) {
      alert(`Error starting conversion: ${err.message}`);
      setIsProcessing(false);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let val = bytes;
    while (val >= 1024 && i < units.length - 1) {
      val /= 1024;
      i++;
    }
    return `${val.toFixed(1)} ${units[i]}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className="clean-card p-5 sm:p-6 w-full max-w-2xl mx-auto space-y-6"
    >
      {/* Video Preview & Info Row */}
      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
        <div className="w-full sm:w-56 shrink-0">
          <InteractiveMediaPlayer metadata={metadata} />
        </div>

        <div className="flex-1 min-w-0 space-y-1.5 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-white/5">
              {getPlatformLabel(metadata.platform)}
            </span>
            {metadata.durationFormatted && (
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {metadata.durationFormatted}
              </span>
            )}
            {metadata.resolutionLabel && (
              <span className="text-xs text-zinc-400 font-mono">
                {metadata.resolutionLabel}
              </span>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-semibold text-zinc-100 line-clamp-2 leading-snug">
            {metadata.title}
          </h3>

          <p className="text-xs text-zinc-400">
            Choose a format below to convert and download immediately.
          </p>
        </div>
      </div>

      {/* Progress & Status Card if a job is running */}
      <AnimatePresence>
        {activeJob && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-2xl bg-zinc-900/80 border border-white/10 space-y-3"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-300 flex items-center gap-1.5">
                {isProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-300" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                )}
                {activeJob.message || activeJob.stage}
              </span>
              <span className="font-semibold text-zinc-100">{activeJob.progress}%</span>
            </div>

            {/* Smooth Progress Bar */}
            <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${
                  activeJob.status === 'ready' || activeJob.status === 'completed'
                    ? 'bg-emerald-400'
                    : 'bg-zinc-100'
                }`}
                animate={{ width: `${activeJob.progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {activeJob.status === 'ready' && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-zinc-400">
                  Ready: {formatBytes(activeJob.outputSize)}
                </span>
                <a
                  href={getDownloadUrl(activeJob.id, activeJob.accessToken)}
                  download={activeJob.outputFilename}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-900 hover:bg-white transition-all shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save File
                </a>
              </div>
            )}

            {activeJob.status === 'failed' && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
                <span>{activeJob.error || activeJob.message || 'Processing failed. Please try again.'}</span>
                <button
                  type="button"
                  onClick={() => setActiveJob(null)}
                  className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 transition-colors font-medium text-[11px]"
                >
                  Dismiss
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversion Variants: Clean, 1-Click Cards directly underneath */}
      <div className="space-y-2 pt-2 border-t border-white/[0.06]">
        <div className="text-xs font-medium text-zinc-400 mb-3">
          Available Formats (Click to convert & download)
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Variant 1: Original High Quality Video */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() =>
              handleStartVariant('hd', 'video', 'mp4', undefined, 'original')
            }
            className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
              selectedVariant === 'hd' && isProcessing
                ? 'border-zinc-300 bg-white/5'
                : 'border-white/[0.08] hover:border-white/20 bg-zinc-900/50 hover:bg-zinc-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-200">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-100">HD Video (MP4)</div>
                <div className="text-[11px] text-zinc-400">Best original resolution</div>
              </div>
            </div>
            <Download className="w-4 h-4 text-zinc-400" />
          </button>

          {/* Variant 2: Compressed Video */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() =>
              handleStartVariant('compressed', 'compress', 'mp4', 'balanced', 'original')
            }
            className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
              selectedVariant === 'compressed' && isProcessing
                ? 'border-zinc-300 bg-white/5'
                : 'border-white/[0.08] hover:border-white/20 bg-zinc-900/50 hover:bg-zinc-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-200">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-100">Compressed Video</div>
                <div className="text-[11px] text-zinc-400">Lightweight & WhatsApp ready</div>
              </div>
            </div>
            <Download className="w-4 h-4 text-zinc-400" />
          </button>

          {/* Variant 3: MP3 Audio */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() =>
              handleStartVariant('audio', 'audio', 'mp3', undefined, undefined)
            }
            className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
              selectedVariant === 'audio' && isProcessing
                ? 'border-zinc-300 bg-white/5'
                : 'border-white/[0.08] hover:border-white/20 bg-zinc-900/50 hover:bg-zinc-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-200">
                <Music className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-100">Audio (MP3)</div>
                <div className="text-[11px] text-zinc-400">320 kbps crystal clear audio</div>
              </div>
            </div>
            <Download className="w-4 h-4 text-zinc-400" />
          </button>

          {/* Variant 4: Mobile Friendly 480p */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() =>
              handleStartVariant('mobile', 'video', 'mp4', undefined, '480p')
            }
            className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
              selectedVariant === 'mobile' && isProcessing
                ? 'border-zinc-300 bg-white/5'
                : 'border-white/[0.08] hover:border-white/20 bg-zinc-900/50 hover:bg-zinc-800/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-200">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-100">Mobile Video (480p)</div>
                <div className="text-[11px] text-zinc-400">Fast download, low data</div>
              </div>
            </div>
            <Download className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
      </div>

      {/* Convert Another Link Button */}
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Paste another video link
        </button>
      </div>
    </motion.div>
  );
};
