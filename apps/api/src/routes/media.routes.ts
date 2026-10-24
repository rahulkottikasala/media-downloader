import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { InspectMediaSchema } from '@mediaflow/shared';
import { providerRegistry } from '../providers/provider.registry.js';
import { config } from '../config.js';
import { ffmpegService } from '../services/ffmpeg.service.js';

const router = Router();

// Configure multer for local file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueId = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxUploadSizeBytes,
  },
});

// POST /api/media/inspect
router.post('/inspect', async (req: Request, res: Response) => {
  const parseResult = InspectMediaSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid request body',
      details: parseResult.error.errors,
    });
  }

  const { url } = parseResult.data;
  const provider = providerRegistry.findProvider(url);

  if (!provider) {
    return res.status(400).json({
      supported: false,
      platform: 'unknown',
      title: 'Unsupported Media',
      hasVideo: false,
      hasAudio: false,
      availableResolutions: ['original'],
      availableFormats: ['original'],
      error: 'No compatible provider found for this URL',
    });
  }

  try {
    const metadata = await provider.inspect(url);
    return res.json(metadata);
  } catch (err: any) {
    return res.status(500).json({
      supported: false,
      platform: provider.name as any,
      title: 'Inspection Failed',
      hasVideo: false,
      hasAudio: false,
      availableResolutions: ['original'],
      availableFormats: ['original'],
      error: err.message || 'Inspection failed',
    });
  }
});

// POST /api/media/upload
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const uploadedFile = req.file;
  const baseId = path.basename(uploadedFile.filename);

  // Store metadata JSON
  const metaPath = path.join(config.uploadDir, `${baseId}.json`);
  const metaContent = {
    originalName: uploadedFile.originalname,
    mimeType: uploadedFile.mimetype,
    size: uploadedFile.size,
    uploadedAt: Date.now(),
  };
  fs.writeFileSync(metaPath, JSON.stringify(metaContent));

  try {
    const localProvider = providerRegistry.findProvider('local://');
    if (!localProvider) {
      throw new Error('Local file provider unavailable');
    }

    const metadata = await localProvider.inspect(`local://${baseId}`);
    return res.json({
      uploadId: baseId,
      metadata,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `Failed to inspect uploaded file: ${err.message}`,
    });
  }
});

// GET /api/media/stream/:uploadId - Stream uploaded local file with 206 Partial Content
router.get('/stream/:uploadId', (req: Request, res: Response) => {
  const uploadId = Array.isArray(req.params.uploadId) ? req.params.uploadId[0] : req.params.uploadId;
  const cleanId = path.basename(uploadId);
  const filePath = path.join(config.uploadDir, cleanId);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Uploaded media file not found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  let contentType = 'video/mp4';
  const metaPath = path.join(config.uploadDir, `${cleanId}.json`);
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (meta.mimeType) contentType = meta.mimeType;
    } catch {}
  }

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send(`Requested range not satisfiable\n${start} >= ${fileSize}`);
      return;
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// GET /api/media/proxy - Proxy external media streams with range headers
router.get('/proxy', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing target url parameter' });
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      Accept: '*/*',
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const upstream = await fetch(targetUrl, {
      headers,
    });

    res.status(upstream.status);
    upstream.headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      if (['content-type', 'content-length', 'content-range', 'accept-ranges'].includes(lower)) {
        res.setHeader(key, val);
      }
    });

    if (upstream.body) {
      const { Readable } = await import('stream');
      // @ts-ignore
      Readable.fromWeb(upstream.body).pipe(res);
    } else {
      res.end();
    }
  } catch (err: any) {
    res.status(500).json({ error: `Proxy stream failed: ${err.message}` });
  }
});

export const mediaRouter: Router = router;
