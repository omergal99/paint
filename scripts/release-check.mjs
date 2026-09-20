import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const errors = [];
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const walk = (directory) => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
  const relative = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(relative) : [relative];
});

const run = (command, args, label) => {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) errors.push(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
};

const packageJson = JSON.parse(read('package.json'));
const versionSource = read('js/version.js');
const serviceWorker = read('sw.js');
const manifest = JSON.parse(read('manifest.json'));
const appVersion = versionSource.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
const cacheVersion = serviceWorker.match(/CACHE_NAME\s*=\s*['"]([^'"]+)['"]/)?.[1];
const expectedCacheVersion = `paint-shell-v${appVersion?.replaceAll('.', '-')}`;

if (!appVersion) errors.push('APP_VERSION is missing from js/version.js.');
if (packageJson.version !== appVersion) errors.push(`package.json (${packageJson.version}) and APP_VERSION (${appVersion}) differ.`);
if (cacheVersion !== expectedCacheVersion) errors.push(`Service-worker cache (${cacheVersion}) is not synchronized with ${expectedCacheVersion}.`);
if (!read('index.html').includes('manifest.json')) errors.push('index.html does not reference manifest.json.');

const pngDimensions = (relativePath) => {
  const buffer = fs.readFileSync(path.join(root, relativePath));
  if (buffer.length < 24 || buffer.readUInt32BE(0) !== 0x89504e47 || buffer.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

const requiredIcons = [
  { src: 'css/assets/icon-192.png', width: 192, height: 192 },
  { src: 'css/assets/icon-512.png', width: 512, height: 512 },
  { src: 'css/assets/icon-512-maskable.png', width: 512, height: 512 },
];
requiredIcons.forEach(({ src, width, height }) => {
  if (!fs.existsSync(path.join(root, src))) {
    errors.push(`Missing PWA icon: ${src}`);
    return;
  }
  const dimensions = pngDimensions(src);
  if (!dimensions || dimensions.width !== width || dimensions.height !== height) {
    errors.push(`PWA icon ${src} is not ${width}x${height}.`);
  }
});

if (!Array.isArray(manifest.icons) || !manifest.icons.some((icon) => icon.src === 'css/assets/icon-192.png')) {
  errors.push('manifest.json does not expose the 192px PNG icon.');
}
if (!Array.isArray(manifest.icons) || !manifest.icons.some((icon) => icon.src === 'css/assets/icon-512-maskable.png' && icon.purpose === 'maskable')) {
  errors.push('manifest.json does not expose the maskable PNG icon.');
}

const shellMatch = serviceWorker.match(/const SHELL = \[([\s\S]*?)\];/);
const shellAssets = [...(shellMatch?.[1] || '').matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
if (!shellMatch || !shellAssets.length) errors.push('Service-worker shell asset list is missing or empty.');
shellAssets.forEach((asset) => {
  if (!fs.existsSync(path.join(root, asset.slice(2)))) errors.push(`Service-worker shell asset is missing: ${asset}`);
});

const sourceFiles = [...walk('js'), ...walk('scripts'), ...walk('tests')].filter((file) => file.endsWith('.js'));
sourceFiles.forEach((file) => run(process.execPath, ['--check', file], `Syntax check ${file}`));
run(process.execPath, ['scripts/docs-consistency.mjs'], 'Documentation consistency');
run(process.execPath, ['--test', ...walk('tests').filter((file) => file.endsWith('.test.js'))], 'Node test suite');

try {
  execFileSync('git', ['diff', '--check'], { cwd: root, stdio: 'inherit' });
} catch {
  errors.push('git diff --check failed.');
}

if (errors.length) {
  console.error('\nRelease verification: FAIL');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log('\nRelease verification: PASS');
  console.log(`Version ${appVersion}; ${sourceFiles.length} JavaScript files checked; ${shellAssets.length} service-worker assets checked.`);
}
