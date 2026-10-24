import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { CreateJobSchema } from '@mediaflow/shared';
import { jobManagerService } from '../services/job-manager.service.js';

const router = Router();

// Helper to extract access token from query or header
function extractToken(req: Request): string | undefined {
  const queryToken = req.query.token as string | undefined;
  const headerToken = req.headers['x-access-token'] as string | undefined;
  return queryToken || headerToken;
}

// POST /api/jobs
router.post('/', async (req: Request, res: Response) => {
  const parseResult = CreateJobSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid job parameters',
      details: parseResult.error.errors,
    });
  }

  try {
    const job = await jobManagerService.createJob(parseResult.data);
    return res.status(201).json(job);
  } catch (err: any) {
    return res.status(500).json({
      error: `Failed to create job: ${err.message}`,
    });
  }
});

// GET /api/jobs/:id
router.get('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const token = extractToken(req);
  const job = jobManagerService.getJobPublic(id, token);

  if (!job) {
    return res.status(404).json({ error: 'Job not found or invalid token' });
  }

  return res.json(job);
});

// GET /api/jobs/:id/events (Server-Sent Events)
router.get('/:id/events', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const token = extractToken(req);
  const internalJob = jobManagerService.getJob(id);

  if (!internalJob || (token && internalJob.accessToken !== token)) {
    return res.status(404).json({ error: 'Job not found or invalid token' });
  }

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable proxy buffering (Nginx, etc.)
  });

  // Send initial state immediately
  const initialDto = jobManagerService.toPublicDto(internalJob);
  res.write(`data: ${JSON.stringify(initialDto)}\n\n`);

  // If already reached terminal state, end after initial
  if (
    internalJob.status === 'completed' ||
    internalJob.status === 'failed' ||
    internalJob.status === 'cancelled'
  ) {
    return res.end();
  }

  // Subscribe to progress events
  const unsubscribe = jobManagerService.subscribeEvents(id, (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (
        event.status === 'completed' ||
        event.status === 'ready' ||
        event.status === 'failed' ||
        event.status === 'cancelled'
      ) {
        // Keep stream open briefly then close
        setTimeout(() => {
          try {
            res.end();
          } catch {}
        }, 1000);
      }
    } catch {}
  });

  // Keep-alive heartbeat every 15 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {}
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// GET /api/jobs/:id/download
router.get('/:id/download', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const token = extractToken(req);
  const internalJob = jobManagerService.getJob(id);

  if (!internalJob) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (token && internalJob.accessToken !== token) {
    return res.status(403).json({ error: 'Forbidden: Invalid access token' });
  }

  if (internalJob.status !== 'ready' && internalJob.status !== 'completed') {
    return res.status(400).json({
      error: `Media is not ready for download. Current status: ${internalJob.status}`,
    });
  }

  if (!internalJob.outputFilePath || !fs.existsSync(internalJob.outputFilePath)) {
    return res.status(410).json({
      error: 'The processed media file has expired or was removed',
    });
  }

  const stat = fs.statSync(internalJob.outputFilePath);
  const filename = internalJob.outputFilename || 'mediaflow-download';

  // Mark active stream
  internalJob.hasActiveDownloadStream = true;
  internalJob.downloadCount++;

  res.setHeader('Content-Length', stat.size);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  res.setHeader('Content-Type', 'application/octet-stream');

  const fileStream = fs.createReadStream(internalJob.outputFilePath);
  fileStream.pipe(res);

  fileStream.on('end', () => {
    internalJob.hasActiveDownloadStream = false;
    internalJob.status = 'completed';
  });

  fileStream.on('error', () => {
    internalJob.hasActiveDownloadStream = false;
  });

  req.on('close', () => {
    internalJob.hasActiveDownloadStream = false;
  });
});

// DELETE /api/jobs/:id (Cancellation)
router.delete('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const token = extractToken(req);
  const success = jobManagerService.cancelJob(id, token);

  if (!success) {
    return res.status(400).json({
      error: 'Job could not be cancelled. It may not exist, already be finished, or invalid token provided.',
    });
  }

  return res.json({ success: true, message: 'Job successfully cancelled' });
});

// POST /api/jobs/batch-zip (Export multiple jobs into a single ZIP)
router.post('/batch-zip', async (req: Request, res: Response) => {
  const { jobIds } = req.body;
  if (!Array.isArray(jobIds) || jobIds.length === 0) {
    return res.status(400).json({ error: 'jobIds must be a non-empty array' });
  }

  const validFiles: Array<{ filename: string; path: string }> = [];

  for (const id of jobIds) {
    const job = jobManagerService.getJob(id);
    if (job && job.outputFilePath && fs.existsSync(job.outputFilePath)) {
      validFiles.push({
        filename: job.outputFilename || `media-${id}`,
        path: job.outputFilePath,
      });
    }
  }

  if (validFiles.length === 0) {
    return res.status(404).json({ error: 'No ready files found for the provided job IDs' });
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="mediaflow-batch-download.zip"');

  const archive = archiver('zip', {
    zlib: { level: 5 },
  });

  archive.pipe(res);

  for (const file of validFiles) {
    archive.file(file.path, { name: file.filename });
  }

  await archive.finalize();
});

export const jobsRouter: Router = router;
