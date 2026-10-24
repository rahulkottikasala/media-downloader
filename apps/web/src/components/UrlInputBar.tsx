import React, { useState, useRef } from 'react';
import {
  Link2,
  Clipboard,
  Sparkles,
  X,
  UploadCloud,
  FileVideo,
  FileAudio,
  Loader2,
} from 'lucide-react';

interface UrlInputBarProps {
  onInspectUrl: (url: string) => void;
  onFileUpload: (file: File) => void;
  isLoading: boolean;
  uploadProgress?: number;
}

export const UrlInputBar: React.FC<UrlInputBarProps> = ({
  onInspectUrl,
  onFileUpload,
  isLoading,
  uploadProgress,
}) => {
  const [url, setUrl] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch {
      // Permission denied or not supported, ignore
    }
  };

  const handleClear = () => {
    setUrl('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onInspectUrl(url.trim());
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
      e.target.value = '';
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 mb-8">
      {/* Search & URL Bar */}
      <form onSubmit={handleSubmit} className="relative group">
        <div className="relative flex items-center glass-panel rounded-2xl p-2 border border-white/10 shadow-2xl transition-all duration-300 focus-within:border-purple-500/50 focus-within:ring-2 focus-within:ring-purple-500/20">
          <div className="pl-3 pr-2 text-slate-400">
            <Link2 className="w-5 h-5 group-focus-within:text-purple-400 transition-colors" />
          </div>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a video or media link here..."
            disabled={isLoading}
            className="w-full bg-transparent px-2 py-2 text-sm sm:text-base text-slate-100 placeholder-slate-500 outline-none disabled:opacity-50"
          />

          <div className="flex items-center gap-1.5 pr-1">
            {url && (
              <button
                type="button"
                onClick={handleClear}
                disabled={isLoading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handlePaste}
              disabled={isLoading}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              <Clipboard className="w-3.5 h-3.5" />
              Paste
            </button>

            <button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-primary hover:bg-gradient-hover shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:pointer-events-none active:scale-95"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Inspecting...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Get Media</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Or Local File Dropzone */}
      <div className="mt-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*,.mp4,.webm,.mkv,.mov,.mp3,.wav,.m4a"
          onChange={handleFileChange}
          className="hidden"
        />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center justify-center gap-3 p-4 rounded-xl border border-dashed cursor-pointer transition-all ${
            isDragOver
              ? 'border-purple-400 bg-purple-500/10'
              : 'border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04]'
          }`}
        >
          <UploadCloud className="w-5 h-5 text-purple-400" />
          <span className="text-xs sm:text-sm text-slate-400">
            Or drag and drop local video or audio files here to convert (MP4, MOV, WebM, MP3...)
          </span>
        </div>

        {uploadProgress !== undefined && uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Uploading local file...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-purple-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
