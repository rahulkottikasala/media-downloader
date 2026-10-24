import React from 'react';
import { Play, Sun, Moon, Sparkles, Layers, Link as LinkIcon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface NavbarProps {
  activeTab: 'single' | 'bulk';
  onTabChange: (tab: 'single' | 'bulk') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#111216]/80 border-b border-white/[0.06] transition-colors">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center text-white shadow-sm">
            <Play className="w-4 h-4 fill-white" />
          </div>
          <div>
            <span className="font-semibold text-base text-zinc-100 tracking-tight">MediaFlow</span>
          </div>
        </div>

        {/* Center Mode Switcher: Single vs Bulk Playlist */}
        <div className="flex items-center p-1 bg-zinc-900/90 border border-white/10 rounded-full">
          <button
            onClick={() => onTabChange('single')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'single'
                ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Downloader</span>
          </button>
          <button
            onClick={() => onTabChange('bulk')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'bulk'
                ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Playlist & Bulk</span>
          </button>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
