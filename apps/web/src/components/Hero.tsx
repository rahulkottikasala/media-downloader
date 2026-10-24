import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ShieldCheck, Zap, Layers } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <div className="relative pt-12 pb-8 text-center px-4 max-w-4xl mx-auto">
      {/* Background glow orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Feature pill */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-purple-300 mb-6 shadow-sm"
      >
        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
        <span>Hardware-Accelerated FFmpeg Media Processing</span>
      </motion.div>

      {/* Main Title */}
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white mb-4"
      >
        All Your Media.{' '}
        <span className="text-gradient">One Simple Tool.</span>
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed"
      >
        Download supported media, extract audio, convert formats, and compress videos in one place.
      </motion.p>

      {/* Quick highlights */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 font-medium"
      >
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          Zero Data Logging
        </span>
        <span className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-cyan-400" />
          High-Speed Transcoding
        </span>
        <span className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-purple-400" />
          No Compression Upscaling
        </span>
      </motion.div>
    </div>
  );
};
