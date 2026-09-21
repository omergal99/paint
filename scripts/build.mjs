import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outputDirectory = path.join(root, 'dist');
const relativeToOutput = (file) => path.relative(outputDirectory, path.resolve(root, file)).split(path.sep).join('/');
const publicPath = (file) => `./${file.replace(/^\.\//, '')}`;

const copy = async (relativePath) => {
  const source = path.join(root, relativePath);
  const destination = path.join(outputDirectory, relativePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true });
};

// `dist/` is deliberately the only generated target. Keeping source modules
// untouched lets development remain readable while Pages receives one compact,
// code-split production graph.
await fs.rm(outputDirectory, { recursive: true, force: true });
await fs.mkdir(outputDirectory, { recursive: true });

const javascript = await build({
  absWorkingDir: root,
  entryPoints: ['js/app.js'],
  outdir: outputDirectory,
  outbase: '.',
  entryNames: '[dir]/[name]',
  chunkNames: 'js/chunks/[name]-[hash]',
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  target: ['es2020'],
  metafile: true,
  logLevel: 'silent',
});

const styles = await build({
  absWorkingDir: root,
  entryPoints: ['css/styles.css', 'css/progressive.css'],
  outdir: outputDirectory,
  outbase: '.',
  entryNames: '[dir]/[name]',
  bundle: true,
  minify: true,
  target: ['es2020'],
  metafile: true,
  logLevel: 'silent',
});

await Promise.all([
  copy('index.html'),
  copy('manifest.json'),
  copy('robots.txt'),
  copy('sitemap.xml'),
  copy('css/assets'),
]);

const generatedAssets = [javascript, styles]
  .flatMap(({ metafile }) => Object.keys(metafile.outputs))
  .map(relativeToOutput)
  .map(publicPath);

const staticAssets = [
  './',
  './index.html',
  './manifest.json',
  './css/assets/icon.svg',
  './css/assets/icon-192.png',
  './css/assets/icon-512.png',
  './css/assets/icon-512-maskable.png',
];

const shell = [...new Set([...staticAssets, ...generatedAssets])];
const sourceWorker = await fs.readFile(path.join(root, 'sw.js'), 'utf8');
const sourceCacheName = sourceWorker.match(/const CACHE_NAME\s*=\s*['"]([^'"]+)['"];/)?.[1];
if (!sourceCacheName) throw new Error('Could not read the source service-worker cache name.');

const fingerprintAssets = async (assets) => {
  const fingerprint = createHash('sha256');
  for (const asset of assets.filter((asset) => asset !== './')) {
    fingerprint.update(asset);
    fingerprint.update(await fs.readFile(path.join(outputDirectory, asset.slice(2))));
  }
  return fingerprint.digest('hex');
};

// A cache-name change is not enough when a browser already has a worker at the
// same script URL. Give each production build its own worker URL as well. The
// pre-patch shell hash makes this change whenever any shipped shell asset does,
// while the final fingerprint below still names the exact patched shell.
const fingerprintWithWorkerSource = async (assets) => createHash('sha256')
  .update(await fingerprintAssets(assets))
  .update(sourceWorker)
  .digest('hex');

const workerBuildId = (await fingerprintWithWorkerSource(shell)).slice(0, 12);
const appEntry = path.join(outputDirectory, 'js/app.js');
const bundledApp = await fs.readFile(appEntry, 'utf8');
const workerUrlPattern = /`\.\/sw\.js\?version=\$\{encodeURIComponent\(([^)]+)\)\}`/;
const productionWorkerUrl = `\`./sw.js?version=\${encodeURIComponent($1)}&build=${workerBuildId}\``;
const appWithBuildWorkerUrl = bundledApp.replace(workerUrlPattern, productionWorkerUrl);
if (appWithBuildWorkerUrl === bundledApp) {
  throw new Error('Could not add the production build identifier to the service-worker URL.');
}
await fs.writeFile(appEntry, appWithBuildWorkerUrl);

// The source worker is version-synchronised for development and release
// checks. Production adds a shell-content suffix so a same-version Pages
// redeploy cannot accidentally reuse a stale `index.html`, CSS, or app entry.
const productionCacheName = `${sourceCacheName}-${(await fingerprintWithWorkerSource(shell)).slice(0, 12)}`;
const workerWithCacheName = sourceWorker.replace(
  /const CACHE_NAME\s*=\s*['"][^'"]+['"];/,
  `const CACHE_NAME = '${productionCacheName}';`,
);
if (workerWithCacheName === sourceWorker) throw new Error('Could not generate the production service-worker cache name.');
const productionWorker = workerWithCacheName.replace(
  /const SHELL = \[[\s\S]*?\];/,
  `const SHELL = ${JSON.stringify(shell, null, 2)};`,
);
if (productionWorker === workerWithCacheName) throw new Error('Could not generate the production service-worker shell.');
await fs.writeFile(path.join(outputDirectory, 'sw.js'), productionWorker);

console.log(`Built ${shell.length} offline-shell assets in ${path.relative(root, outputDirectory)}/ (${productionCacheName}).`);
