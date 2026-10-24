import React, { useState, useRef } from 'react';
import {
  Link2,
  Clipboard,
  ArrowRight,
  X,
  Upload,
  Film,
  Sparkles,
  Loader2,
  Cloud,
  Globe,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface CleanInputBarProps {
  onInspect: (url: string) => void;
  onFileUpload: (file: File) => void;
  isLoading: boolean;
}

export const CleanInputBar: React.FC<CleanInputBarProps> = ({
  onInspect,
  onFileUpload,
  isLoading,
}) => {
  const [url, setUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        onInspect(text.trim());
      }
    } catch {}
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onInspect(url.trim());
    }
  };

  const handleSampleShort = () => {
    const sample = 'https://www.youtube.com/shorts/iaAQs3WKT-Q';
    setUrl(sample);
    onInspect(sample);
  };

  const handleSampleDirect = () => {
    const sample = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    setUrl(sample);
    onInspect(sample);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">
      {/* Search Input Bar */}
      <form onSubmit={handleSubmit}>
        <div className="clean-input flex items-center p-2 pl-4 shadow-sm focus-within:border-white/30 focus-within:ring-1 focus-within:ring-white/20">
          <Link2 className="w-4 h-4 text-zinc-400 shrink-0 mr-2" />

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube, Instagram, TeraBox, or web link..."
            disabled={isLoading}
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none disabled:opacity-50"
          />

          <div className="flex items-center gap-1.5 shrink-0">
            {url && (
              <button
                type="button"
                onClick={() => setUrl('')}
                disabled={isLoading}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Clear"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={handlePaste}
              disabled={isLoading}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Clipboard className="w-3.5 h-3.5" />
              Paste
            </button>

            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-100 text-zinc-900 hover:bg-white disabled:opacity-40 transition-all shadow-sm active:scale-95"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>Fetch</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Hidden File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            onFileUpload(e.target.files[0]);
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* Suggestions Row */}
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <span className="text-[11px] text-zinc-500">Supported:</span>

        <button
          type="button"
          onClick={handleSampleShort}
          className="cute-pill bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-white/5 flex items-center gap-1.5"
          title="Try a sample YouTube Short"
        >
          <Film className="w-3 h-3 text-red-400" />
          <span>YouTube</span>
        </button>

        <span className="cute-pill bg-zinc-800/80 text-zinc-300 border border-white/5 flex items-center gap-1.5 cursor-default">
          <Sparkles className="w-3 h-3 text-pink-400" />
          <span>Instagram</span>
        </span>

        <span className="cute-pill bg-zinc-800/80 text-zinc-300 border border-white/5 flex items-center gap-1.5 cursor-default">
          <Cloud className="w-3 h-3 text-sky-400" />
          <span>TeraBox</span>
        </span>

        <span className="cute-pill bg-zinc-800/80 text-zinc-300 border border-white/5 flex items-center gap-1.5 cursor-default">
          <Globe className="w-3 h-3 text-emerald-400" />
          <span>Web Video (1000+)</span>
        </span>

        <button
          type="button"
          onClick={handleSampleDirect}
          className="cute-pill bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-white/5 flex items-center gap-1.5"
          title="Try a sample direct MP4"
        >
          <Film className="w-3 h-3 text-cyan-400" />
          <span>Direct MP4</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="cute-pill bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-300 border border-white/5 flex items-center gap-1.5"
        >
          <Upload className="w-3 h-3 text-purple-400" />
          <span>Upload File</span>
        </button>
      </div>
    </div>
  );
};
