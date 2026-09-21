import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const projectRoot = path.resolve(import.meta.dirname, '..');

export const contentTypeFor = (file) => ({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
}[path.extname(file).toLowerCase()] || 'application/octet-stream');

export const resolveRequestPath = async ({ directory, pathname }) => {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  let target = path.resolve(directory, decoded.replace(/^\/+/, '') || 'index.html');
  if (target !== directory && !target.startsWith(`${directory}${path.sep}`)) return null;
  try {
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    return target;
  } catch {
    return null;
  }
};

export const createPaintServer = ({ directory }) => createServer(async (request, response) => {
  if (!request.url || !['GET', 'HEAD'].includes(request.method || '')) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = await resolveRequestPath({ directory, pathname });
  if (!file) {
    response.writeHead(404, { 'Cache-Control': 'no-store' });
    response.end('Not found');
    return;
  }

  try {
    const body = await readFile(file);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Length': body.length,
      'Content-Type': contentTypeFor(file),
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404, { 'Cache-Control': 'no-store' });
    response.end('Not found');
  }
});

const option = (args, name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};

export const startPaintServer = async ({ args = process.argv.slice(2) } = {}) => {
  const port = Number(option(args, '--port', '4173'));
  const requestedDirectory = option(args, '--directory', '.');
  const directory = path.resolve(projectRoot, requestedDirectory);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('--port must be an integer from 0 to 65535.');
  if (directory !== projectRoot && !directory.startsWith(`${projectRoot}${path.sep}`)) {
    throw new Error('--directory must stay inside the project root.');
  }
  if (!(await stat(directory)).isDirectory()) throw new Error(`Not a directory: ${requestedDirectory}`);

  const server = createPaintServer({ directory });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const address = server.address();
  const listeningPort = typeof address === 'object' && address ? address.port : port;
  console.log(`Paint local server: http://127.0.0.1:${listeningPort}/ (${path.relative(projectRoot, directory) || '.'})`);
  return server;
};

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  startPaintServer().then((server) => {
    const close = () => server.close(() => process.exit(0));
    process.once('SIGINT', close);
    process.once('SIGTERM', close);
  }).catch((error) => {
    console.error(`Could not start Paint local server: ${error.message}`);
    process.exitCode = 1;
  });
}
