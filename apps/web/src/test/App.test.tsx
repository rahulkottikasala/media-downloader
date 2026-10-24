import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { App } from '../App';

// Mock fetch
global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes('/api/health')) {
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'ok',
          uptimeSeconds: 100,
          ffmpegAvailable: true,
          ffprobeAvailable: true,
          ffmpegVersion: 'ffmpeg version 9.0.2',
          activeJobs: 0,
          queuedJobs: 0,
        }),
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  });
});

describe('MediaFlow Frontend Web App', () => {
  it('renders brand name and main hero title', () => {
    render(<App />);

    // Brand and Tagline
    expect(screen.getAllByText(/MediaFlow/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Download. Convert. Enjoy./i).length).toBeGreaterThan(0);

    // Hero title & Subtitle
    expect(screen.getByText(/All Your Media./i)).toBeInTheDocument();
    expect(
      screen.getByText(/Download supported media, extract audio, convert formats, and compress videos in one place./i)
    ).toBeInTheDocument();

    // Input placeholder
    expect(
      screen.getByPlaceholderText(/Paste a video or media link here.../i)
    ).toBeInTheDocument();

    // Buttons
    expect(screen.getByRole('button', { name: /Get Media/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Paste/i })).toBeInTheDocument();
  });
});
