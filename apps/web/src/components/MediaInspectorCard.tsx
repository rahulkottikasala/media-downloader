import React, { useState } from 'react';
import {
  FileVideo,
  FileAudio,
  Film,
  Music,
  Sliders,
  Download,
  AlertCircle,
  Clock,
  HardDrive,
  Maximize2,
  ChevronDown,
  Info,
} from 'lucide-react';
import type {
  MediaMetadata,
  MediaFormat,
  VideoResolution,
  AudioBitrate,
  CompressionPreset,
  CreateJobInput,
} from '@mediaflow/shared';

interface MediaInspectorCardProps {
  metadata: MediaMetadata;
  onStartJob: (input: CreateJobInput) => void;
  isStarting: boolean;
}

export const MediaInspectorCard: React.FC<MediaInspectorCardProps> = ({
  metadata,
  onStartJob,
  isStarting,
}) => {
  const [outputType, setOutputType] = useState<'video' | 'audio' | 'compress'>(
    metadata.hasVideo ? 'video' : 'audio'
  );
  const [targetFormat, setTargetFormat] = useState<MediaFormat>(
    metadata.hasVideo ? 'mp4' : 'mp3'
  );
  const [targetResolution, setTargetResolution] = useState<VideoResolution>('original');
  const [audioBitrate, setAudioBitrate] = useState<AudioBitrate>('128k');
  const [compressionPreset, setCompressionPreset] = useState<CompressionPreset>('balanced');
  const [customFilename, setCustomFilename] = useState('');
  const [showAdvancedCompress, setShowAdvancedCompress] = useState(false);
  const [crf, setCrf] = useState(28);
  const [customFps, setCustomFps] = useState<number | undefined>(undefined);

  // If unsupported provider (e.g. YouTube or Instagram without auth, or error)
  if (!metadata.supported) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 mb-8">
        <div className="glass-panel rounded-2xl p-6 border border-amber-500/20 bg-amber-500/5 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 mt-1">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  {metadata.platform.toUpperCase()}
                </span>
                <h3 className="text-lg font-bold text-slate-100">{metadata.title}</h3>
              </div>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                {metadata.message || metadata.error || 'Media extraction is not supported for this source.'}
              </p>
              <div className="mt-4 p-3 rounded-xl bg-black/20 border border-white/5 text-xs text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  MediaFlow strictly complies with third-party service terms and access controls. We do
                  not bypass bot protection, login walls, or DRM. Direct media links and local file
                  conversions remain 100% operational.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleStart = () => {
    onStartJob({
      url: metadata.sourceUrl,
      uploadId: metadata.uploadId,
      outputType,
      targetFormat,
      targetResolution: outputType === 'video' || outputType === 'compress' ? targetResolution : undefined,
      audioBitrate: outputType === 'audio' ? audioBitrate : undefined,
      compressionPreset: outputType === 'compress' ? compressionPreset : undefined,
      customFilename: customFilename.trim() || undefined,
      advancedOptions:
        outputType === 'compress' && showAdvancedCompress
          ? {
              crf,
              fps: customFps,
            }
          : undefined,
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 mb-8">
      <div className="glass-panel rounded-2xl p-6 border border-white/10 shadow-2xl space-y-6">
        {/* Media Header & Info */}
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {/* Media icon or preview box */}
          <div className="w-full sm:w-36 h-28 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden relative group">
            {metadata.hasVideo ? (
              <FileVideo className="w-10 h-10 text-purple-400" />
            ) : (
              <FileAudio className="w-10 h-10 text-cyan-400" />
            )}
            <span className="absolute bottom-2 right-2 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-black/60 text-slate-300">
              {metadata.platform}
            </span>
          </div>

          {/* Details */}
          <div className="flex-1 space-y-2">
            <h3 className="text-lg font-bold text-slate-100 line-clamp-2" title={metadata.title}>
              {metadata.title}
            </h3>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              {metadata.durationFormatted && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  {metadata.durationFormatted}
                </span>
              )}
              {metadata.sizeFormatted && (
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
                  {metadata.sizeFormatted}
                </span>
              )}
              {metadata.resolutionLabel && (
                <span className="flex items-center gap-1">
                  <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
                  {metadata.resolutionLabel}
                </span>
              )}
            </div>

            {/* Custom output filename input */}
            <div className="pt-2">
              <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                Custom Output Filename (Optional)
              </label>
              <input
                type="text"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                placeholder="e.g. my-converted-media"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-purple-500/50"
              />
            </div>
          </div>
        </div>

        {/* Workflow Tabs: Video / Audio / Compress */}
        <div className="border-t border-white/5 pt-5">
          <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/5 mb-5">
            {metadata.hasVideo && (
              <button
                type="button"
                onClick={() => {
                  setOutputType('video');
                  setTargetFormat('mp4');
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                  outputType === 'video'
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                Video Download
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setOutputType('audio');
                setTargetFormat('mp3');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                outputType === 'audio'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              Audio Extraction
            </button>

            {metadata.hasVideo && (
              <button
                type="button"
                onClick={() => {
                  setOutputType('compress');
                  setTargetFormat('mp4');
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all ${
                  outputType === 'compress'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Video Compressor
              </button>
            )}
          </div>

          {/* Video Options */}
          {outputType === 'video' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Format Container
                </label>
                <select
                  value={targetFormat}
                  onChange={(e) => setTargetFormat(e.target.value as MediaFormat)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                >
                  <option value="original">Original Format</option>
                  <option value="mp4">MP4 (H.264 / AAC)</option>
                  <option value="webm">WebM (VP9 / Opus)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Resolution (No Upscaling)
                </label>
                <select
                  value={targetResolution}
                  onChange={(e) => setTargetResolution(e.target.value as VideoResolution)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                >
                  {metadata.availableResolutions.map((res) => (
                    <option key={res} value={res}>
                      {res === 'original' ? 'Original Resolution' : res}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Audio Options */}
          {outputType === 'audio' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Audio Format
                </label>
                <select
                  value={targetFormat}
                  onChange={(e) => setTargetFormat(e.target.value as MediaFormat)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                >
                  <option value="mp3">MP3 (Universal)</option>
                  <option value="m4a">M4A (Apple AAC)</option>
                  <option value="wav">WAV (Lossless PCM)</option>
                  <option value="aac">AAC (Raw Stream)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Audio Bitrate
                </label>
                <select
                  value={audioBitrate}
                  onChange={(e) => setAudioBitrate(e.target.value as AudioBitrate)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none"
                >
                  <option value="64k">64 kbps (Voice / Low)</option>
                  <option value="96k">96 kbps (Standard Voice)</option>
                  <option value="128k">128 kbps (Standard Audio)</option>
                  <option value="192k">192 kbps (High Quality)</option>
                  <option value="256k">256 kbps (Very High Quality)</option>
                  <option value="320k">320 kbps (Maximum Quality)</option>
                </select>
              </div>
            </div>
          )}

          {/* Video Compressor Options */}
          {outputType === 'compress' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['high', 'balanced', 'small'] as CompressionPreset[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCompressionPreset(p)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      compressionPreset === p
                        ? 'border-indigo-500 bg-indigo-500/15 text-white'
                        : 'border-white/5 bg-white/[0.02] text-slate-400 hover:border-white/10'
                    }`}
                  >
                    <div className="font-bold text-xs capitalize text-slate-200">{p} Quality</div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {p === 'high' && 'Preserves details, slight reduction'}
                      {p === 'balanced' && 'Best ratio of size to quality'}
                      {p === 'small' && 'Smallest file size for sharing'}
                    </div>
                  </button>
                ))}
              </div>

              {/* Advanced toggle */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedCompress(!showAdvancedCompress)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${
                      showAdvancedCompress ? 'rotate-180' : ''
                    }`}
                  />
                  Advanced Compression Settings
                </button>

                {showAdvancedCompress && (
                  <div className="mt-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-300 block mb-1">
                        CRF (Constant Rate Factor: 0 = lossless, 51 = lowest): {crf}
                      </label>
                      <input
                        type="range"
                        min={18}
                        max={40}
                        value={crf}
                        onChange={(e) => setCrf(parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-300 block mb-1">
                        Resolution Limit
                      </label>
                      <select
                        value={targetResolution}
                        onChange={(e) => setTargetResolution(e.target.value as VideoResolution)}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                      >
                        {metadata.availableResolutions.map((res) => (
                          <option key={res} value={res}>
                            {res === 'original' ? 'Original Resolution' : res}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="border-t border-white/5 pt-4 flex justify-end">
          <button
            type="button"
            onClick={handleStart}
            disabled={isStarting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-gradient-primary hover:bg-gradient-hover shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Start Processing & Download</span>
          </button>
        </div>
      </div>
    </div>
  );
};
