import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const fixturesDir = path.resolve('tests/fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

console.log('Generating media fixtures in:', fixturesDir);

// 1. Generate 1080p sample MP4 video with audio (5 seconds)
const sample1080p = path.join(fixturesDir, 'sample-1080p.mp4');
if (!fs.existsSync(sample1080p)) {
  console.log('Creating sample-1080p.mp4...');
  const res = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=5:size=1920x1080:rate=30',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=5',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      sample1080p,
    ],
    { stdio: 'inherit' }
  );
  if (res.status !== 0) {
    console.error('Failed to create sample-1080p.mp4');
  }
}

// 2. Generate 720p sample MP4
const sample720p = path.join(fixturesDir, 'sample-720p.mp4');
if (!fs.existsSync(sample720p)) {
  console.log('Creating sample-720p.mp4...');
  spawnSync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=4:size=1280x720:rate=30',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=880:duration=4',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      sample720p,
    ],
    { stdio: 'inherit' }
  );
}

// 3. Generate sample MP3
const sampleMp3 = path.join(fixturesDir, 'sample-audio.mp3');
if (!fs.existsSync(sampleMp3)) {
  console.log('Creating sample-audio.mp3...');
  spawnSync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=523:duration=5',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '192k',
      sampleMp3,
    ],
    { stdio: 'inherit' }
  );
}

console.log('Fixtures generated successfully.');
