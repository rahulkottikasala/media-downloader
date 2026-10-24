import { createServer } from './server.js';
import { config } from './config.js';

const app = createServer();

const server = app.listen(config.port, config.host, () => {
  console.log(`MediaFlow API Server running on http://${config.host}:${config.port}`);
  console.log(`FFmpeg binary: ${config.ffmpegPath}`);
  console.log(`FFprobe binary: ${config.ffprobePath}`);
  console.log(`Temp dir: ${config.tempDir}`);
});

function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
