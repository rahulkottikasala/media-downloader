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

export const mediaRouter: Router = router;
