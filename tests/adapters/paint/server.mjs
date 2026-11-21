import path from 'node:path';
import { startProcessServer } from '../../core/process/process-server.mjs';

const projectRoot = path.resolve(import.meta.dirname, '../../..');

export const startPaintServer = ({ timeoutMs, shutdownGraceMs, signal } = {}) => startProcessServer({
  command: process.execPath,
  args: [path.join(projectRoot, 'scripts/serve.mjs'), '--port', '0'],
  cwd: projectRoot,
  readyPattern: /Paint local server: (http:\/\/127\.0\.0\.1:\d+\/)/,
  timeoutMs,
  shutdownGraceMs,
  signal,
});
