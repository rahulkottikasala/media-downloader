import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  Film,
  X,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MediaMetadata } from '@mediaflow/shared';
import { getApiBaseUrl } from '../api';

interface InteractiveMediaPlayerProps {
  metadata: MediaMetadata;
  className?: string;
}

export function resolvePlaybackUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  const apiBase = getApiBaseUrl();
  const origin = apiBase.endsWith('/api') ? apiBase.slice(0, -4) : apiBase;
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export const InteractiveMediaPlayer: React.FC<InteractiveMediaPlayerProps> = ({
  metadata,
  className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(metadata.duration || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<'left' | 'right' | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapTimeRef = useRef<{ time: number; side: 'left' | 'right' } | null>(null);

  const playbackUrl = resolvePlaybackUrl(metadata.previewUrl);
  const hasEmbed = !!metadata.embedUrl;
  const canPlay = hasEmbed || !!playbackUrl;

  // Sync duration when metadata updates
  useEffect(() => {
    if (metadata.duration) {
      setDuration(metadata.duration);
    }
  }, [metadata.duration]);

  // Hide controls after 3 seconds of inactivity during playback
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    resetControlsTimer();
  };

  const seekRelative = (seconds: number, side: 'left' | 'right') => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setDoubleTapFeedback(side);
    setTimeout(() => setDoubleTapFeedback(null), 600);
    resetControlsTimer();
  };

  // Double tap handler for mobile phone player experience
  const handleTouchZone = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeft = x < rect.width / 2;
    const side: 'left' | 'right' = isLeft ? 'left' : 'right';
    const now = Date.now();

    if (
      lastTapTimeRef.current &&
      now - lastTapTimeRef.current.time < 300 &&
      lastTapTimeRef.current.side === side
    ) {
      // Double tap triggered
      if (side === 'left') {
        seekRelative(-10, 'left');
      } else {
        seekRelative(10, 'right');
      }
      lastTapTimeRef.current = null;
    } else {
      lastTapTimeRef.current = { time: now, side };
      // Single tap toggles controls
      setShowControls((prev) => !prev);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
    setCurrentTime(time);
    resetControlsTimer();
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const mm = m < 10 ? `0${m}` : `${m}`;
    const ss = s < 10 ? `0${s}` : `${s}`;
    return `${mm}:${ss}`;
  };

  // Keyboard navigation when expanded
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-10, 'left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        seekRelative(10, 'right');
      } else if (e.key === 'Escape') {
        setIsExpanded(false);
      } else if (e.key === 'm') {
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded, isPlaying, duration]);

  // Video element event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => {
      if (video.duration && !isNaN(video.duration)) {
        setDuration(video.duration);
      }
    };
    const onEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('ended', onEnded);
    };
  }, [isPlaying]);

  return (
    <>
      {/* ================= COMPACT INLINE BOX PLAYER ================= */}
      <div
        ref={containerRef}
        className={`relative w-full h-44 sm:h-48 rounded-2xl overflow-hidden bg-black/95 border border-white/10 group select-none ${className}`}
        onMouseMove={resetControlsTimer}
      >
        {/* If embed player (e.g. YouTube) is playing */}
        {hasEmbed && isPlaying ? (
          <iframe
            src={metadata.embedUrl}
            title={metadata.title}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : playbackUrl && isPlaying ? (
          /* HTML5 Video Player */
          <div className="relative w-full h-full" onClick={handleTouchZone}>
            <video
              ref={videoRef}
              src={playbackUrl}
              muted={isMuted}
              playsInline
              className="w-full h-full object-contain"
              poster={metadata.thumbnail}
            />

            {/* Double Tap Ripple Indicators */}
            {doubleTapFeedback && (
              <div
                className={`absolute inset-y-0 ${
                  doubleTapFeedback === 'left' ? 'left-0' : 'right-0'
                } w-1/3 flex items-center justify-center bg-white/10 pointer-events-none animate-pulse`}
              >
                <span className="text-xs font-bold text-white bg-black/60 px-2.5 py-1 rounded-full backdrop-blur-md">
                  {doubleTapFeedback === 'left' ? '⏪ -10s' : '+10s ⏩'}
                </span>
              </div>
            )}

            {/* Inline Mini Controls Overlay */}
            <AnimatePresence>
              {showControls && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-between p-2.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-zinc-300 truncate max-w-[200px]">
                      {metadata.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsExpanded(true)}
                      className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-zinc-200 hover:text-white transition-all shadow-sm"
                      title="Expand to Full Player"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Bottom Bar */}
                  <div className="space-y-1">
                    {/* Scrubber */}
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.1}
                      value={currentTime}
                      onChange={handleSeek}
                      className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                    />

                    <div className="flex items-center justify-between text-[11px] text-zinc-300">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={togglePlay}
                          className="p-1 hover:text-white transition-colors"
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 fill-white" />
                          ) : (
                            <Play className="w-4 h-4 fill-white" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsMuted((prev) => !prev)}
                          className="p-1 hover:text-white transition-colors"
                        >
                          {isMuted ? (
                            <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
                          ) : (
                            <Volume2 className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <span className="font-mono text-[10px]">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsExpanded(true)}
                        className="text-[10px] font-medium text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
                      >
                        <span>Full Size</span>
                        <Maximize2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* Thumbnail with Play & Expand Overlay */
          <div className="relative w-full h-full">
            {metadata.thumbnail ? (
              <img
                src={metadata.thumbnail}
                alt={metadata.title}
                className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-2">
                <Film className="w-8 h-8 text-zinc-600" />
                <span className="text-xs">Preview Ready</span>
              </div>
            )}

            {/* Dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />

            {/* Platform Tag */}
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
              <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-black/70 text-white backdrop-blur-sm border border-white/10 uppercase">
                {metadata.platform}
              </span>
              {metadata.durationFormatted && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/70 text-zinc-300 backdrop-blur-sm border border-white/10">
                  {metadata.durationFormatted}
                </span>
              )}
            </div>

            {/* Top Right: Expand to Full Screen / Player Icon (Square symbol) */}
            <button
              type="button"
              onClick={() => {
                setIsPlaying(true);
                setIsExpanded(true);
              }}
              className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white backdrop-blur-sm border border-white/10 transition-all shadow-md active:scale-95"
              title="Expand to Full Player"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            {/* Center Play Button */}
            {canPlay && (
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => setIsPlaying(true)}
                  className="w-12 h-12 rounded-full bg-white/90 hover:bg-white text-zinc-950 flex items-center justify-center shadow-xl backdrop-blur-md transition-all pl-0.5"
                  title="Play Preview"
                >
                  <Play className="w-5 h-5 fill-zinc-950" />
                </motion.button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================= FULL EXPANDED PHONE-LIKE PLAYER MODAL ================= */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col justify-between p-4 sm:p-6 select-none"
            onMouseMove={resetControlsTimer}
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between w-full max-w-4xl mx-auto z-10">
              <div className="flex items-center gap-2 min-w-0 pr-4">
                <span className="text-xs font-bold tracking-wider px-2 py-0.5 rounded-md bg-white/10 text-white uppercase shrink-0">
                  {metadata.platform}
                </span>
                <h3 className="text-sm font-semibold text-white truncate">{metadata.title}</h3>
              </div>

              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors"
                title="Minimize Player"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Center Stage Video Player */}
            <div className="flex-1 flex items-center justify-center w-full max-w-4xl mx-auto relative my-2">
              {hasEmbed ? (
                <div className="w-full h-full max-h-[75vh] aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl border border-white/10">
                  <iframe
                    src={metadata.embedUrl}
                    title={metadata.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : playbackUrl ? (
                <div
                  className="relative w-full h-full max-h-[75vh] flex items-center justify-center rounded-3xl overflow-hidden bg-black shadow-2xl border border-white/10 cursor-pointer"
                  onClick={handleTouchZone}
                >
                  <video
                    ref={videoRef}
                    src={playbackUrl}
                    muted={isMuted}
                    playsInline
                    autoPlay
                    className="w-full h-full object-contain"
                    poster={metadata.thumbnail}
                  />

                  {/* Double Tap Ripple Indicators */}
                  {doubleTapFeedback && (
                    <div
                      className={`absolute inset-y-0 ${
                        doubleTapFeedback === 'left' ? 'left-0' : 'right-0'
                      } w-1/3 flex items-center justify-center bg-white/10 pointer-events-none animate-pulse`}
                    >
                      <span className="text-sm font-bold text-white bg-black/70 px-4 py-2 rounded-full backdrop-blur-md">
                        {doubleTapFeedback === 'left' ? '⏪ -10 seconds' : '+10 seconds ⏩'}
                      </span>
                    </div>
                  )}

                  {/* Big Center Play/Pause Indicator (Fades out) */}
                  <AnimatePresence>
                    {!isPlaying && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none"
                      >
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                          <Play className="w-8 h-8 fill-white pl-1" />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-center space-y-2 text-zinc-400">
                  <Film className="w-12 h-12 mx-auto text-zinc-600" />
                  <p className="text-sm">Video stream is being processed for download</p>
                </div>
              )}
            </div>

            {/* Bottom Controls Bar (For HTML5 Video) */}
            {!hasEmbed && playbackUrl && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-4xl mx-auto space-y-3 z-10 bg-black/40 p-4 rounded-2xl backdrop-blur-md border border-white/5"
              >
                {/* Scrubber Bar */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"
                  />
                </div>

                {/* Controls Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => seekRelative(-10, 'left')}
                      className="p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                      title="Rewind 10 seconds"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={togglePlay}
                      className="p-2.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 transition-all shadow-md active:scale-95"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? (
                        <Pause className="w-5 h-5 fill-zinc-950" />
                      ) : (
                        <Play className="w-5 h-5 fill-zinc-950 pl-0.5" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => seekRelative(10, 'right')}
                      className="p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                      title="Forward 10 seconds"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>

                    <span className="font-mono text-xs text-zinc-300 ml-2">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsMuted((prev) => !prev)}
                      className="p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsExpanded(false)}
                      className="p-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                      title="Minimize"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
