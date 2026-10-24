import React, { useState, useRef } from 'react';
import {
  Layers,
  UploadCloud,
  FileCheck,
  Download,
  Archive,
  Loader2,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import type { MediaFormat, JobPublicDto } from '@mediaflow/shared';
import { uploadLocalMedia, createJob, exportBatchZip, getDownloadUrl } from '../api';

interface BatchItem {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'converting' | 'ready' | 'failed';
  uploadId?: string;
  job?: JobPublicDto;
  progress: number;
  error?: string;
}

export const BatchPage: React.FC = () => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [targetFormat, setTargetFormat] = useState<MediaFormat>('mp4');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesAdded = (files: FileList | null) => {
    if (!files) return;
    const newItems: BatchItem[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued',
      progress: 0,
    }));
    setItems((prev) => [...prev, ...newItems]);
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleProcessAll = async () => {
    setIsProcessing(true);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status === 'ready') continue;

      // Update item to uploading
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, status: 'uploading', progress: 10 } : it
        )
      );

      try {
        // Upload
        const uploadRes = await uploadLocalMedia(item.file, (pct) => {
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id ? { ...it, progress: Math.round(pct * 0.4) } : it
            )
          );
        });

        // Create job
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: 'converting', progress: 50 } : it
          )
        );

        const isAudio =
          targetFormat === 'mp3' ||
          targetFormat === 'm4a' ||
          targetFormat === 'wav' ||
          targetFormat === 'aac';

        const job = await createJob({
          uploadId: uploadRes.uploadId,
          outputType: isAudio ? 'audio' : 'video',
          targetFormat,
        });

        // Wait for job completion via polling or short timeout
        let currentJob = job;
        while (
          currentJob.status !== 'ready' &&
          currentJob.status !== 'completed' &&
          currentJob.status !== 'failed' &&
          currentJob.status !== 'cancelled'
        ) {
          await new Promise((r) => setTimeout(r, 1000));
          const res = await fetch(`/api/jobs/${currentJob.id}?token=${currentJob.accessToken}`);
          if (res.ok) {
            currentJob = await res.json();
            setItems((prev) =>
              prev.map((it) =>
                it.id === item.id
                  ? {
                      ...it,
                      progress: 50 + Math.round(currentJob.progress * 0.5),
                    }
                  : it
              )
            );
          }
        }

        if (currentJob.status === 'ready' || currentJob.status === 'completed') {
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: 'ready', progress: 100, job: currentJob }
                : it
            )
          );
        } else {
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? { ...it, status: 'failed', error: currentJob.error || 'Conversion failed' }
                : it
            )
          );
        }
      } catch (err: any) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: 'failed', error: err.message } : it
          )
        );
      }
    }

    setIsProcessing(false);
  };

  const handleDownloadZip = async () => {
    const readyJobIds = items
      .filter((it) => it.status === 'ready' && it.job?.id)
      .map((it) => it.job!.id);

    if (readyJobIds.length === 0) return;

    setIsZipping(true);
    try {
      const blob = await exportBatchZip(readyJobIds);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mediaflow-batch-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Failed to download zip: ${err.message}`);
    } finally {
      setIsZipping(false);
    }
  };

  const readyCount = items.filter((it) => it.status === 'ready').length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 mb-4">
          <Layers className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-2">Batch Media Converter</h1>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Convert multiple files in one batch. Choose your shared output format, process sequentially, and download individually or export all in a single ZIP.
        </p>
      </div>

      {/* Multi-file Dropzone */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*"
        onChange={(e) => handleFilesAdded(e.target.files)}
        className="hidden"
      />

      <div
        onClick={() => fileInputRef.current?.click()}
        className="p-8 rounded-2xl border-2 border-dashed border-white/10 hover:border-purple-500/50 bg-white/[0.02] hover:bg-white/[0.04] transition-all cursor-pointer flex flex-col items-center justify-center gap-3 text-center mb-8"
      >
        <div className="p-3 rounded-xl bg-purple-500/20 text-purple-400">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div>
          <span className="text-sm font-semibold text-slate-200">
            Click or drag multiple media files here
          </span>
          <p className="text-xs text-slate-400 mt-1">
            Supports MP4, MOV, WebM, AVI, MP3, WAV, M4A
          </p>
        </div>
      </div>

      {/* Settings & Batch Controls */}
      {items.length > 0 && (
        <div className="glass-panel rounded-2xl p-6 border border-white/10 mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Target Output Format for Batch
              </label>
              <select
                value={targetFormat}
                onChange={(e) => setTargetFormat(e.target.value as MediaFormat)}
                disabled={isProcessing}
                className="bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
              >
                <option value="mp4">MP4 Video (H.264 / AAC)</option>
                <option value="webm">WebM Video (VP9 / Opus)</option>
                <option value="mp3">MP3 Audio (128 kbps)</option>
                <option value="m4a">M4A Audio (AAC)</option>
                <option value="wav">WAV Audio (Lossless PCM)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleProcessAll}
                disabled={isProcessing || items.every((it) => it.status === 'ready')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-primary hover:bg-gradient-hover shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Batch...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4" />
                    <span>Convert All ({items.length})</span>
                  </>
                )}
              </button>

              {readyCount > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={isZipping}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 transition-all disabled:opacity-50"
                >
                  {isZipping ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Archive className="w-4 h-4" />
                  )}
                  <span>Export ZIP ({readyCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Items List */}
          <div className="border-t border-white/5 pt-4 space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 p-3 rounded-xl bg-white/[0.02] border border-white/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-200 truncate">
                      {item.file.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({(item.file.size / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        item.status === 'ready'
                          ? 'text-emerald-400'
                          : item.status === 'failed'
                            ? 'text-rose-400'
                            : 'text-purple-400'
                      }`}
                    >
                      {item.status}
                    </span>
                    {item.status !== 'ready' && item.status !== 'failed' && (
                      <span className="text-[10px] text-slate-400">{item.progress}%</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.status === 'ready' && item.job && (
                    <a
                      href={getDownloadUrl(item.job.id, item.job.accessToken)}
                      download={item.job.outputFilename}
                      className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}

                  {!isProcessing && (
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
