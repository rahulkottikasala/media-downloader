import React, { useState } from 'react';
import {
  Layers,
  Download,
  Loader2,
  Archive,
  CheckCircle2,
  Sparkles,
  Play,
  Film,
  Music,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { inspectMediaUrl, createJob, exportBatchZip, getDownloadUrl, getJob } from '../api';
import type { MediaFormat, JobPublicDto } from '@mediaflow/shared';

interface PlaylistItem {
  id: string;
  title: string;
  durationFormatted?: string;
  url: string;
  thumbnail?: string;
  status: 'idle' | 'converting' | 'ready' | 'failed';
  job?: JobPublicDto;
  progress: number;
}

export const PlaylistBulkDownloader: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<PlaylistItem[]>([]);
  const [targetFormat, setTargetFormat] = useState<MediaFormat>('mp4');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [playlistTitle, setPlaylistTitle] = useState<string | null>(null);

  const handleInspect = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);

    try {
      const urls = inputText
        .split('\n')
        .map((u) => u.trim())
        .filter((u) => u.startsWith('http'));

      if (urls.length === 0) {
        alert('Please enter at least one valid video or playlist URL');
        setIsLoading(false);
        return;
      }

      // If single URL that might be a playlist
      if (urls.length === 1) {
        const meta = await inspectMediaUrl(urls[0]);
        if (meta.isPlaylist && meta.playlistEntries && meta.playlistEntries.length > 0) {
          setPlaylistTitle(meta.title);
          setItems(
            meta.playlistEntries.map((e) => ({
              id: e.id,
              title: e.title,
              durationFormatted: e.durationFormatted,
              url: e.url,
              thumbnail: e.thumbnail,
              status: 'idle',
              progress: 0,
            }))
          );
        } else {
          // Single video entered in bulk mode
          setPlaylistTitle(meta.title);
          setItems([
            {
              id: meta.uploadId || 'video-1',
              title: meta.title,
              durationFormatted: meta.durationFormatted,
              url: urls[0],
              thumbnail: meta.thumbnail,
              status: 'idle',
              progress: 0,
            },
          ]);
        }
      } else {
        // Multiple URLs pasted
        setPlaylistTitle(`Batch List (${urls.length} Videos)`);
        setItems(
          urls.map((url, i) => ({
            id: `video-${i + 1}`,
            title: `Media ${i + 1}`,
            url,
            status: 'idle',
            progress: 0,
          }))
        );
      }
    } catch (err: any) {
      alert(`Failed to load playlist: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessAll = async () => {
    setIsProcessing(true);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.status === 'ready') continue;

      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, status: 'converting', progress: 15 } : it))
      );

      try {
        const isAudio = targetFormat === 'mp3' || targetFormat === 'm4a' || targetFormat === 'wav';
        const job = await createJob({
          url: item.url,
          outputType: isAudio ? 'audio' : 'video',
          targetFormat,
        });

        // Poll job status
        let currentJob = job;
        while (
          currentJob.status !== 'ready' &&
          currentJob.status !== 'completed' &&
          currentJob.status !== 'failed'
        ) {
          await new Promise((r) => setTimeout(r, 1200));
          try {
            currentJob = await getJob(currentJob.id, currentJob.accessToken);
            setItems((prev) =>
              prev.map((it) =>
                it.id === item.id
                  ? { ...it, progress: Math.max(15, currentJob.progress) }
                  : it
              )
            );
          } catch {}
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
              it.id === item.id ? { ...it, status: 'failed', progress: 0 } : it
            )
          );
        }
      } catch (err) {
        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, status: 'failed', progress: 0 } : it
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
      a.download = `mediaflow-playlist-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Failed to create ZIP: ${err.message}`);
    } finally {
      setIsZipping(false);
    }
  };

  const readyCount = items.filter((it) => it.status === 'ready').length;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Input box */}
      <div className="clean-card p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-100 mb-1">
            Bulk & Playlist Downloader
          </h2>
          <p className="text-xs text-zinc-400">
            Paste a YouTube playlist link or multiple video links (one per line).
          </p>
        </div>

        <textarea
          rows={3}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="https://www.youtube.com/playlist?list=...&#10;or paste multiple video URLs here"
          className="w-full bg-zinc-900 border border-white/10 rounded-2xl p-3 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:border-white/20 transition-all resize-none"
        />

        <div className="flex items-center justify-between">
          <div className="text-[11px] text-zinc-500">
            Supports YouTube playlists, Shorts, and multi-link batches
          </div>

          <button
            type="button"
            onClick={handleInspect}
            disabled={isLoading || !inputText.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-50 transition-all shadow"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Loading Playlist...</span>
              </>
            ) : (
              <>
                <Layers className="w-3.5 h-3.5" />
                <span>Load Videos</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Playlist List & Controls */}
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="clean-card p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">{playlistTitle}</h3>
              <p className="text-xs text-zinc-400">{items.length} items found</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={targetFormat}
                onChange={(e) => setTargetFormat(e.target.value as MediaFormat)}
                disabled={isProcessing}
                className="bg-zinc-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
              >
                <option value="mp4">MP4 Video</option>
                <option value="mp3">MP3 Audio</option>
              </select>

              <button
                type="button"
                onClick={handleProcessAll}
                disabled={isProcessing || items.every((it) => it.status === 'ready')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-50 transition-all shadow"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download All ({items.length})</span>
                  </>
                )}
              </button>

              {readyCount > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={isZipping}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow"
                >
                  {isZipping ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Archive className="w-3.5 h-3.5" />
                  )}
                  <span>Export ZIP ({readyCount})</span>
                </button>
              )}
            </div>
          </div>

          {/* Videos list */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-zinc-900/60 border border-white/[0.04]"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-xs text-zinc-500 font-mono w-5 shrink-0 text-center">
                    {index + 1}
                  </span>

                  {item.thumbnail && (
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      className="w-12 h-8 rounded-lg object-cover bg-zinc-800 shrink-0"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-zinc-200 truncate">{item.title}</p>
                    <span className="text-[10px] text-zinc-400 capitalize">
                      {item.status === 'converting' ? `Processing ${item.progress}%` : item.status}
                    </span>
                  </div>
                </div>

                <div>
                  {item.status === 'ready' && item.job && (
                    <a
                      href={getDownloadUrl(item.job.id, item.job.accessToken)}
                      download={item.job.outputFilename}
                      className="p-1.5 rounded-lg bg-white/10 text-zinc-200 hover:bg-white/20 transition-colors inline-block"
                      title="Download file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};
