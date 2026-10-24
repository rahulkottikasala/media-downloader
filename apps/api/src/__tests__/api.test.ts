import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createServer } from '../server.js';
import { validateSafeUrl, isPrivateIp } from '../services/ssrf.service.js';

describe('MediaFlow API Test Suite', () => {
  const app = createServer();

  describe('Health Endpoint', () => {
    it('GET /api/health should return 200 with ffmpeg and ffprobe status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.ffmpegAvailable).toBe(true);
      expect(res.body.ffprobeAvailable).toBe(true);
      expect(typeof res.body.uptimeSeconds).toBe('number');
    });
  });

  describe('SSRF Protection Service', () => {
    it('should identify private and loopback IPv4 addresses', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('172.16.5.10')).toBe(true);
      expect(isPrivateIp('192.168.1.1')).toBe(true);
      expect(isPrivateIp('169.254.169.254')).toBe(true);
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('1.1.1.1')).toBe(false);
    });

    it('should block local hostnames and schemes', async () => {
      const localResult = await validateSafeUrl('http://localhost:3000/video.mp4');
      expect(localResult.valid).toBe(false);

      const fileResult = await validateSafeUrl('file:///etc/passwd');
      expect(fileResult.valid).toBe(false);

      const privateIpResult = await validateSafeUrl('http://192.168.1.100/test.mp4');
      expect(privateIpResult.valid).toBe(false);
    });
  });

  describe('Media Inspect Endpoint - Third-Party Platforms', { timeout: 60000 }, () => {
    it('should detect YouTube standard URL and return structured unsupported response', async () => {
      const res = await request(app)
        .post('/api/media/inspect')
        .send({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });

      expect(res.status).toBe(200);
      expect(res.body.platform).toBe('youtube');
      expect(res.body.supported).toBe(true);
    }, 15000);

    it('should detect YouTube Shorts URL and return structured response', async () => {
      const res = await request(app)
        .post('/api/media/inspect')
        .send({ url: 'https://www.youtube.com/shorts/abcdef12345' });

      expect(res.status).toBe(200);
      expect(res.body.platform).toBe('youtube');
    });

    it('should detect youtu.be short link', async () => {
      const res = await request(app)
        .post('/api/media/inspect')
        .send({ url: 'https://youtu.be/dQw4w9WgXcQ' });

      expect(res.status).toBe(200);
      expect(res.body.platform).toBe('youtube');
      expect(res.body.supported).toBe(true);
    });

    it('should detect Instagram Reel URL and return structured unsupported response', async () => {
      const res = await request(app)
        .post('/api/media/inspect')
        .send({ url: 'https://www.instagram.com/reel/C123456789/' });

      expect(res.status).toBe(200);
      expect(res.body.platform).toBe('instagram');
      expect(res.body.supported).toBe(false);
      expect(res.body.message).toBe(
        'URL detection works, but media downloading is unsupported by the configured provider.'
      );
    });

    it('should detect TeraBox link and return terabox platform', async () => {
      const res = await request(app)
        .post('/api/media/inspect')
        .send({ url: 'https://www.terabox.com/s/1UmsZ_phFHNDQkjR-MNrOqg' });

      expect(res.status).toBe(200);
      expect(res.body.platform).toBe('terabox');
      expect(res.body.title).toBeTruthy();
    }, 15000);

    it('should detect and inspect web video link', async () => {
      const res = await request(app)
        .post('/api/media/inspect')
        .send({
          url: 'https://xhamster46.desi/videos/i-argue-with-my-stepson-and-we-end-up-fucking-in-the-kitchen-xhB2bCM',
        });

      expect(res.status).toBe(200);
      expect(res.body.platform).toBe('webvideo');
      expect(res.body.supported).toBe(true);
      expect(res.body.title).toBeTruthy();
    }, 35000);

    it('should reject invalid or malformed URLs', async () => {
      const res = await request(app)
        .post('/api/media/inspect')
        .send({ url: 'not-a-valid-url' });

      expect(res.status).toBe(400);
    });
  });

  describe('Job Management', () => {
    it('should reject job creation with invalid body', async () => {
      const res = await request(app).post('/api/jobs').send({});
      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent job ID', async () => {
      const res = await request(app).get('/api/jobs/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });
});
