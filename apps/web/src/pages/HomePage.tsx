import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { CleanInputBar } from '../components/CleanInputBar';
import { CleanMediaCard } from '../components/CleanMediaCard';
import { PlaylistBulkDownloader } from '../components/PlaylistBulkDownloader';
import { inspectMediaUrl, uploadLocalMedia } from '../api';
import type { MediaMetadata } from '@mediaflow/shared';
import { motion, AnimatePresence } from 'framer-motion';

export const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const [isLoading, setIsLoading] = useState(false);
  const [inspectedMedia, setInspectedMedia] = useState<MediaMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInspect = async (url: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const meta = await inspectMediaUrl(url);
      setInspectedMedia(meta);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch media');
      setInspectedMedia(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await uploadLocalMedia(file);
      setInspectedMedia(res.metadata);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setInspectedMedia(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#111216] text-zinc-100 transition-colors">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-12 sm:py-16 space-y-8">
        {/* Minimal Hero */}
        <div className="text-center space-y-2 max-w-xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {activeTab === 'single'
              ? 'Paste any link to download & convert'
              : 'Bulk & Playlist Downloader'}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            {activeTab === 'single'
              ? 'YouTube, Instagram, TeraBox, web videos, and MP3 extraction in one click.'
              : 'Batch download entire YouTube playlists or multi-link collections as a single ZIP.'}
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="max-w-xl mx-auto p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 text-center">
            {error}
          </div>
        )}

        {/* Tab View: Single vs Bulk */}
        <AnimatePresence mode="wait">
          {activeTab === 'single' ? (
            <motion.div
              key="single"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {!inspectedMedia && (
                <CleanInputBar
                  onInspect={handleInspect}
                  onFileUpload={handleFileUpload}
                  isLoading={isLoading}
                />
              )}

              {inspectedMedia && (
                <CleanMediaCard
                  metadata={inspectedMedia}
                  onReset={() => setInspectedMedia(null)}
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              key="bulk"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <PlaylistBulkDownloader />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Minimal Footer */}
      <footer className="py-6 border-t border-white/[0.04] text-center text-[11px] text-zinc-500">
        <p>MediaFlow — Minimal, Clean & Fast Media Downloader</p>
      </footer>
    </div>
  );
};
