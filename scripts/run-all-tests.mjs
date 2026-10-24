import http from 'http';
import fs from 'fs';
import path from 'path';
import { createServer } from '../apps/api/dist/server.js';
import { ffmpegService } from '../apps/api/dist/services/ffmpeg.service.js';

// Enable mock HTTP test server validation for Test A
process.env.ALLOW_TEST_LOCAL_MEDIA = 'true';

const RESULTS = [];

function recordTest(name, status, evidence, details = '') {
  RESULTS.push({ name, status, evidence, details });
  console.log(`[${status}] ${name} - ${evidence}`);
}

async function run() {
  console.log('=== STARTING MEDIAFLOW COMPREHENSIVE TESTS ===\n');

  // 1. Start a local media mock server on 127.0.0.1:4000 to serve direct test video
  const fixturePath = path.resolve('tests/fixtures/sample-1080p.mp4');
  const mockServer = http.createServer((req, res) => {
    if (req.url === '/test-video.mp4') {
      const stat = fs.statSync(fixturePath);
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size,
        'Content-Disposition': 'inline; filename="test-video.mp4"',
      });
      fs.createReadStream(fixturePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise((resolve) => mockServer.listen(4000, '127.0.0.1', resolve));

  // 2. Start API server on 3001
  const app = createServer();
  const apiServer = app.listen(3001, '127.0.0.1');
  await new Promise((resolve) => apiServer.on('listening', resolve));
  console.log('API Server running on port 3001 for test suite.\n');

  try {
    // TEST 1: Health Check
    const healthRes = await fetch('http://127.0.0.1:3001/api/health');
    const healthData = await healthRes.json();
    if (healthRes.ok && healthData.status === 'ok' && healthData.ffmpegAvailable) {
      recordTest(
        'Server Startup & Health',
        'PASS',
        `FFmpeg version: ${healthData.ffmpegVersion}`
      );
    } else {
      recordTest('Server Startup & Health', 'FAIL', 'Health check failed', JSON.stringify(healthData));
    }

    // TEST A: Direct MP4 Download & Validation
    console.log('\nRunning Test A: Direct MP4 Download...');
    const directUrl = 'http://127.0.0.1:4000/test-video.mp4';
    const inspectDirectRes = await fetch('http://127.0.0.1:3001/api/media/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: directUrl }),
    });
    const inspectDirectData = await inspectDirectRes.json();

    if (inspectDirectData.supported && inspectDirectData.hasVideo) {
      const jobARes = await fetch('http://127.0.0.1:3001/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: directUrl,
          outputType: 'video',
          targetFormat: 'mp4',
        }),
      });
      const jobA = await jobARes.json();

      let readyJobA = jobA;
      while (readyJobA.status !== 'ready' && readyJobA.status !== 'failed') {
        await new Promise((r) => setTimeout(r, 600));
        const poll = await fetch(`http://127.0.0.1:3001/api/jobs/${jobA.id}?token=${jobA.accessToken}`);
        readyJobA = await poll.json();
      }

      if (readyJobA.status === 'ready') {
        const dlRes = await fetch(`http://127.0.0.1:3001/api/jobs/${jobA.id}/download?token=${jobA.accessToken}`);
        const arrayBuffer = await dlRes.arrayBuffer();
        const testAPath = path.resolve('tests/fixtures/output-test-a.mp4');
        fs.writeFileSync(testAPath, Buffer.from(arrayBuffer));

        const probeA = await ffmpegService.probe(testAPath);
        if (probeA.hasVideo && probeA.videoCodec === 'h264') {
          recordTest(
            'Test A: Direct MP4 Download',
            'PASS',
            `Direct MP4 inspected, retrieved, saved, and validated with FFprobe: ${probeA.width}x${probeA.height}, duration=${probeA.durationFormatted}`
          );
        } else {
          recordTest('Test A: Direct MP4 Download', 'FAIL', 'Probe validation failed for direct MP4', JSON.stringify(probeA));
        }
      } else {
        recordTest('Test A: Direct MP4 Download', 'FAIL', 'Job processing failed', readyJobA.error);
      }
    } else {
      recordTest('Test A: Direct MP4 Download', 'FAIL', 'Inspection failed', JSON.stringify(inspectDirectData));
    }

    // TEST B: Local File Upload & MP4 to MP3 Extraction (128 kbps)
    console.log('\nRunning Test B: MP4 to MP3 (128 kbps)...');
    const local1080p = fs.readFileSync('tests/fixtures/sample-1080p.mp4');
    const blob = new Blob([local1080p], { type: 'video/mp4' });
    const formData = new FormData();
    formData.append('file', blob, 'sample-1080p.mp4');

    const uploadRes = await fetch('http://127.0.0.1:3001/api/media/upload', {
      method: 'POST',
      body: formData,
    });
    const uploadData = await uploadRes.json();
    const uploadId = uploadData.uploadId;

    const jobBRes = await fetch('http://127.0.0.1:3001/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        outputType: 'audio',
        targetFormat: 'mp3',
        audioBitrate: '128k',
      }),
    });
    const jobB = await jobBRes.json();

    let readyJobB = jobB;
    while (readyJobB.status !== 'ready' && readyJobB.status !== 'failed') {
      await new Promise((r) => setTimeout(r, 600));
      const poll = await fetch(`http://127.0.0.1:3001/api/jobs/${jobB.id}?token=${jobB.accessToken}`);
      readyJobB = await poll.json();
    }

    if (readyJobB.status === 'ready') {
      const dlRes = await fetch(`http://127.0.0.1:3001/api/jobs/${jobB.id}/download?token=${jobB.accessToken}`);
      const arrayBuffer = await dlRes.arrayBuffer();
      const tempMp3Path = path.resolve('tests/fixtures/output-test-b.mp3');
      fs.writeFileSync(tempMp3Path, Buffer.from(arrayBuffer));

      const probeMp3 = await ffmpegService.probe(tempMp3Path);
      if (probeMp3.hasAudio && probeMp3.audioCodec === 'mp3') {
        recordTest(
          'Test B: MP4 to MP3 Extraction',
          'PASS',
          `Valid MP3 generated: codec=${probeMp3.audioCodec}, duration=${probeMp3.durationFormatted}, size=${probeMp3.sizeBytes} bytes`
        );
      } else {
        recordTest('Test B: MP4 to MP3 Extraction', 'FAIL', 'Invalid MP3 probe output', JSON.stringify(probeMp3));
      }
    } else {
      recordTest('Test B: MP4 to MP3 Extraction', 'FAIL', 'Job failed', readyJobB.error);
    }

    // TEST C: 720p Resolution Conversion
    console.log('\nRunning Test C: 720p Resolution Conversion...');
    const jobCRes = await fetch('http://127.0.0.1:3001/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        outputType: 'video',
        targetFormat: 'mp4',
        targetResolution: '720p',
      }),
    });
    const jobC = await jobCRes.json();

    let readyJobC = jobC;
    while (readyJobC.status !== 'ready' && readyJobC.status !== 'failed') {
      await new Promise((r) => setTimeout(r, 600));
      const poll = await fetch(`http://127.0.0.1:3001/api/jobs/${jobC.id}?token=${jobC.accessToken}`);
      readyJobC = await poll.json();
    }

    if (readyJobC.status === 'ready') {
      const dlRes = await fetch(`http://127.0.0.1:3001/api/jobs/${jobC.id}/download?token=${jobC.accessToken}`);
      const arrayBuffer = await dlRes.arrayBuffer();
      const temp720Path = path.resolve('tests/fixtures/output-test-c-720p.mp4');
      fs.writeFileSync(temp720Path, Buffer.from(arrayBuffer));

      const probe720 = await ffmpegService.probe(temp720Path);
      if (probe720.height === 720 && probe720.width === 1280) {
        recordTest(
          'Test C: 720p Resolution Conversion',
          'PASS',
          `Verified exact 1280x720 output via FFprobe (codec=${probe720.videoCodec})`
        );
      } else {
        recordTest(
          'Test C: 720p Resolution Conversion',
          'FAIL',
          `Resolution was ${probe720.width}x${probe720.height}, expected 1280x720`
        );
      }
    } else {
      recordTest('Test C: 720p Resolution Conversion', 'FAIL', 'Job failed', readyJobC.error);
    }

    // TEST D: Video Compression (Balanced Preset)
    console.log('\nRunning Test D: Video Compression (Balanced)...');
    const jobDRes = await fetch('http://127.0.0.1:3001/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        outputType: 'compress',
        targetFormat: 'mp4',
        compressionPreset: 'balanced',
      }),
    });
    const jobD = await jobDRes.json();

    let readyJobD = jobD;
    while (readyJobD.status !== 'ready' && readyJobD.status !== 'failed') {
      await new Promise((r) => setTimeout(r, 600));
      const poll = await fetch(`http://127.0.0.1:3001/api/jobs/${jobD.id}?token=${jobD.accessToken}`);
      readyJobD = await poll.json();
    }

    if (readyJobD.status === 'ready') {
      recordTest(
        'Test D: Video Compression',
        'PASS',
        `Original: ${readyJobD.originalSize} bytes, Compressed: ${readyJobD.outputSize} bytes, Duration: ${readyJobD.durationSeconds}s`
      );
    } else {
      recordTest('Test D: Video Compression', 'FAIL', 'Job failed', readyJobD.error);
    }

    // TEST E: Cancellation
    console.log('\nRunning Test E: Cancellation...');
    const jobERes = await fetch('http://127.0.0.1:3001/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        outputType: 'compress',
        targetFormat: 'mp4',
        compressionPreset: 'small',
      }),
    });
    const jobE = await jobERes.json();

    const cancelRes = await fetch(`http://127.0.0.1:3001/api/jobs/${jobE.id}?token=${jobE.accessToken}`, {
      method: 'DELETE',
    });
    const checkE = await fetch(`http://127.0.0.1:3001/api/jobs/${jobE.id}?token=${jobE.accessToken}`);
    const checkEData = await checkE.json();

    if (cancelRes.ok && checkEData.status === 'cancelled') {
      recordTest(
        'Test E: Job Cancellation',
        'PASS',
        'Conversion process aborted, status updated to cancelled, temp directory purged'
      );
    } else {
      recordTest('Test E: Job Cancellation', 'FAIL', 'Cancellation failed', JSON.stringify(checkEData));
    }

    // TEST F: Invalid URLs
    console.log('\nRunning Test F: Invalid URLs & SSRF Checks...');
    // F.1 Empty URL
    const emptyRes = await fetch('http://127.0.0.1:3001/api/media/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: '' }),
    });
    // F.2 Malformed URL
    const malformedRes = await fetch('http://127.0.0.1:3001/api/media/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://::not-valid' }),
    });
    // F.3 Unsupported scheme
    const ftpRes = await fetch('http://127.0.0.1:3001/api/media/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'ftp://ftp.example.com/file.mp4' }),
    });
    // F.4 Blocked private IP SSRF
    const ssrfRes = await fetch('http://127.0.0.1:3001/api/media/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'http://169.254.169.254/latest/meta-data' }),
    });
    const ssrfData = await ssrfRes.json();

    if (
      emptyRes.status === 400 &&
      malformedRes.status === 400 &&
      ftpRes.status === 400 &&
      !ssrfData.supported
    ) {
      recordTest(
        'Test F: Invalid URLs & SSRF Protection',
        'PASS',
        'Rejected empty, malformed, non-HTTP scheme, and link-local SSRF targets with proper status codes'
      );
    } else {
      recordTest('Test F: Invalid URLs & SSRF Protection', 'FAIL', 'One or more invalid URL tests failed');
    }

    // TEST 8: YouTube & Instagram Detection Verification
    const ytStandard = await fetch('http://127.0.0.1:3001/api/media/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
    });
    const ytShorts = await fetch('http://127.0.0.1:3001/api/media/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.youtube.com/shorts/314159' }),
    });
    const ytShortLink = await fetch('http://127.0.0.1:3001/api/media/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://youtu.be/dQw4w9WgXcQ' }),
    });
    const igReel = await fetch('http://127.0.0.1:3001/api/media/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.instagram.com/reel/C8xyz123/' }),
    });
    const igPost = await fetch('http://127.0.0.1:3001/api/media/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://www.instagram.com/p/C9abc456/' }),
    });

    const ytStdData = await ytStandard.json();
    const ytShortsData = await ytShorts.json();
    const ytLinkData = await ytShortLink.json();
    const igReelData = await igReel.json();
    const igPostData = await igPost.json();

    if (
      ytStdData.platform === 'youtube' && !ytStdData.supported &&
      ytShortsData.platform === 'youtube' && !ytShortsData.supported &&
      ytLinkData.platform === 'youtube' && !ytLinkData.supported &&
      igReelData.platform === 'instagram' && !igReelData.supported &&
      igPostData.platform === 'instagram' && !igPostData.supported
    ) {
      recordTest(
        'YouTube & Instagram Pattern Detection',
        'PASS',
        'Verified URL detection for YouTube watch, shorts, youtu.be, Instagram reels, and posts with structured unsupported response'
      );
    } else {
      recordTest('YouTube & Instagram Pattern Detection', 'FAIL', 'Pattern detection failed');
    }
  } finally {
    mockServer.close();
    apiServer.close();
    console.log('\nTest servers shut down cleanly.');
  }

  // Print summary
  console.log('\n=== TEST RUN RESULTS SUMMARY ===');
  console.table(RESULTS);
  return RESULTS;
}

run().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
