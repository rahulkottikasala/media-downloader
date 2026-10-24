import React, { useEffect, useState } from 'react';
import {
  Download,
  XCircle,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileCheck,
  TrendingDown,
} from 'lucide-react';
import type { JobPublicDto, JobProgressEvent } from '@mediaflow/shared';
import { getDownloadUrl, cancelJob } from '../api';

interface JobProgressCardProps {
  initialJob: JobPublicDto;
  onRemove?: () => void;
  onRetry?: () => void;
}

export const JobProgressCard: React.FC<JobProgressCardProps> = ({
  initialJob,
  onRemove,
  onRetry,
}) => {
  const [job, setJob] = useState<JobPublicDto>(initialJob);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    // If already terminal, no need for SSE
    if (
      job.status === 'completed' ||
      job.status === 'failed' ||
      job.status === 'cancelled'
    ) {
      return;
    }

    const eventSource = new EventSource(
      `/api/jobs/${job.id}/events?token=${encodeURIComponent(job.accessToken)}`
    );

    eventSource.onmessage = (e) => {
      try {
        const data: JobProgressEvent = JSON.parse(e.data);
        setJob((prev) => ({
          ...prev,
          status: data.status,
          progress: data.progress,
          stage: data.stage,
          message: data.message || prev.message,
          outputSize: data.outputSize || prev.outputSize,
          originalSize: data.originalSize || prev.originalSize,
          error: data.error || prev.error,
        }));

        if (
          data.status === 'completed' ||
          data.status === 'ready' ||
          data.status === 'failed' ||
          data.status === 'cancelled'
        ) {
          eventSource.close();
        }
      } catch {}
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [job.id, job.accessToken]);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await cancelJob(job.id, job.accessToken);
      setJob((prev) => ({
        ...prev,
        status: 'cancelled',
        stage: 'Cancelled',
        message: 'Job cancelled by user',
      }));
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsCancelling(false);
    }
  };

  const isTerminal =
    job.status === 'ready' ||
    job.status === 'completed' ||
    job.status === 'failed' ||
    job.status === 'cancelled';

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 B';
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
    <div className="glass-panel rounded-2xl p-5 border border-white/10 shadow-xl space-y-4 transition-all">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`p-2.5 rounded-xl ${
              job.status === 'ready' || job.status === 'completed'
                ? 'bg-emerald-500/20 text-emerald-400'
                : job.status === 'failed'
                  ? 'bg-rose-500/20 text-rose-400'
                  : job.status === 'cancelled'
                    ? 'bg-slate-700/50 text-slate-400'
                    : 'bg-purple-500/20 text-purple-400'
            }`}
          >
            {job.status === 'ready' || job.status === 'completed' ? (
              <FileCheck className="w-5 h-5" />
            ) : job.status === 'failed' ? (
              <AlertTriangle className="w-5 h-5" />
            ) : job.status === 'cancelled' ? (
              <XCircle className="w-5 h-5" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin" />
            )}
          </div>

          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-200 truncate">
              {job.outputFilename || `Task ${job.id.slice(0, 8)}`}
            </h4>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="capitalize font-medium text-purple-300">{job.stage}</span>
              {job.durationSeconds !== undefined && job.durationSeconds > 0 && (
                <span>• {job.durationSeconds}s elapsed</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!isTerminal && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-white/5 hover:bg-rose-500/20 hover:text-rose-300 border border-white/10 transition-colors"
            >
              Cancel
            </button>
          )}

          {job.status === 'ready' && (
            <a
              href={getDownloadUrl(job.id, job.accessToken)}
              download={job.outputFilename}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
          )}

          {job.status === 'failed' && onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/10 hover:bg-white/20 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar & Status message */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-400">
          <span className="truncate max-w-[80%]">{job.message || 'Processing media file...'}</span>
          <span className="font-semibold text-slate-200">{job.progress}%</span>
        </div>

        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/5">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              job.status === 'ready' || job.status === 'completed'
                ? 'bg-emerald-500'
                : job.status === 'failed'
                  ? 'bg-rose-500'
                  : job.status === 'cancelled'
                    ? 'bg-slate-600'
                    : 'bg-gradient-primary'
            }`}
            style={{ width: `${job.progress}%` }}
          />
        </div>
      </div>

      {/* Final size & compression report */}
      {job.outputSize !== undefined && job.outputSize > 0 && (
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-wrap items-center justify-between text-xs text-slate-300">
          <div>
            <span>Output Size: </span>
            <span className="font-semibold text-white">{formatBytes(job.outputSize)}</span>
          </div>

          {job.originalSize !== undefined && job.originalSize > 0 && (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>
                {job.originalSize > job.outputSize
                  ? `${Math.round(((job.originalSize - job.outputSize) / job.originalSize) * 100)}% smaller than original`
                  : 'Processed without loss'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
