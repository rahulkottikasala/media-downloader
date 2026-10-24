import { Router, Request, Response } from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from '../config.js';
import { jobManagerService } from '../services/job-manager.service.js';
import type { HealthResponse } from '@mediaflow/shared';

const execFileAsync = promisify(execFile);
const router = Router();
const startTime = Date.now();

router.get('/', async (_req: Request, res: Response) => {
  let ffmpegAvailable = false;
  let ffprobeAvailable = false;
  let ffmpegVersion: string | undefined;

  try {
    const { stdout } = await execFileAsync(config.ffmpegPath, ['-version']);
    ffmpegAvailable = true;
    const firstLine = stdout.split('\n')[0];
    ffmpegVersion = firstLine;
  } catch {}

  try {
    await execFileAsync(config.ffprobePath, ['-version']);
    ffprobeAvailable = true;
  } catch {}

  const metrics = jobManagerService.getMetrics();
  const isHealthy = ffmpegAvailable && ffprobeAvailable;

  const responsePayload: HealthResponse = {
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    ffmpegAvailable,
    ffprobeAvailable,
    ffmpegVersion,
    activeJobs: metrics.activeJobs,
    queuedJobs: metrics.queuedJobs,
  };

  return res.status(isHealthy ? 200 : 503).json(responsePayload);
});

export const healthRouter: Router = router;
