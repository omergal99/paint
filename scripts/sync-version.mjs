import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptsDirectory, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = process.env.PAINT_VERSION || packageJson.version;

if (!/^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid paint version: ${version}`);
}

const versionFile = path.join(root, 'js/version.js');
fs.writeFileSync(versionFile, `export const APP_VERSION = '${version}';\n`);
const serviceWorkerFile = path.join(root, 'sw.js');
const serviceWorker = fs.readFileSync(serviceWorkerFile, 'utf8');
const cacheVersion = version.replace(/\./g, '-');
const cacheMarker = /const CACHE_NAME = 'paint-shell-v[^']+';/;
if (!cacheMarker.test(serviceWorker)) {
  throw new Error('Service-worker cache version marker is missing');
}
// Preserve the shell content hash appended by sync-service-worker-shell.mjs.
// Only the version segment moves here; dropping the hash would collapse every
// deploy of one version into a single cache key.
const currentName = serviceWorker.match(cacheMarker)[0].match(/'([^']+)'/)[1];
const hashSuffix = currentName.match(/-([0-9a-f]{8})$/)?.[1];
const updatedServiceWorker = serviceWorker.replace(
  cacheMarker,
  `const CACHE_NAME = 'paint-shell-v${cacheVersion}${hashSuffix ? `-${hashSuffix}` : ''}';`,
);
fs.writeFileSync(serviceWorkerFile, updatedServiceWorker);
console.log(`Synced paint version ${version} to js/version.js`);
