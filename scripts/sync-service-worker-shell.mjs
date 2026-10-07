// Regenerates the service worker shell from the real import graph and syncs the
// cache name with the app version. `npm run verify:release` fails when the two
// drift, which is how the Phase 3 app modules were caught missing from the
// offline shell. Run `npm run sw:sync` after adding, renaming or removing a
// module, and `npm run sw:check` to verify without writing.
//
//   node scripts/sync-service-worker-shell.mjs          # write sw.js
//   node scripts/sync-service-worker-shell.mjs --check  # verify only
//
// Production builds do not need this: `npm run build` rewrites the shell and
// appends a content fingerprint to the cache name (see scripts/build.mjs).
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const checkOnly = process.argv.includes('--check');
const workerPath = path.join(root, 'sw.js');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

/** Every module reachable from the app entry, following relative imports. */
const collectAppModules = (entry) => {
  const seen = new Set();
  const visit = (file) => {
    const normalized = path.normalize(file);
    if (seen.has(normalized)) return;
    const absolute = path.join(root, normalized);
    if (!fs.existsSync(absolute)) return;
    seen.add(normalized);
    const source = fs.readFileSync(absolute, 'utf8');
    const imports = /\b(?:import\s+|from\s+|import\s*\()\s*['"](\.\.?\/[^'"]+)['"]/g;
    for (const match of source.matchAll(imports)) {
      let dependency = path.normalize(path.join(path.dirname(normalized), match[1]));
      if (!path.extname(dependency)) dependency += '.js';
      if (dependency.startsWith('js' + path.sep)) visit(dependency);
    }
  };
  visit(entry);
  return [...seen].map((file) => `./${file.split(path.sep).join('/')}`);
};

const packageJson = JSON.parse(read('package.json'));
const version = process.env.PAINT_VERSION || packageJson.version;
if (!/^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`Invalid paint version: ${version}`);
const worker = fs.readFileSync(workerPath, 'utf8');
const shellMatch = worker.match(/(const SHELL = \[)([\s\S]*?)(\];)/);
if (!shellMatch) throw new Error('Service-worker SHELL array is missing; cannot sync it.');
const existingShell = [...shellMatch[2].matchAll(/['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);

const appModules = collectAppModules('js/app.js');
const appModuleSet = new Set(appModules);
const missing = appModules.filter((asset) => !existingShell.includes(asset));
const stale = existingShell.filter((asset) => asset.startsWith('./js/') && !fs.existsSync(path.join(root, asset.slice(2))));

// Hash the shell in its final order so a single sync remains stable when a
// newly discovered module is inserted among the existing JavaScript assets.
const nextShell = existingShell.filter((asset) => !stale.includes(asset));
const lastJsIndex = nextShell.reduce((last, asset, index) => (asset.startsWith('./js/') ? index : last), -1);
nextShell.splice(lastJsIndex + 1, 0, ...missing.sort());

// The cache name carries a content hash of the precached shell, not just the app
// version. Static hosts (GitHub Pages) have no version bump between deploys, so a
// version-only name left every same-version deploy serving the previous shell
// forever: `activate` saw the same key and purged nothing. Hashing the shell
// contents makes any code change produce a new cache name, which is what makes
// the worker's `activate` handler drop the stale one.
const shellHash = createHash('sha256');
for (const asset of nextShell) {
  shellHash.update(asset);
  const file = path.join(root, asset.replace(/^\.\//, ''));
  // `missing` entries are being added to the shell in this same run, so their
  // names must count even though there is nothing to read yet.
  if (fs.existsSync(file)) shellHash.update(fs.readFileSync(file));
}
// Include worker behavior in the cache key without making the key depend on
// its own generated value. This makes cacheShell/install/activate changes
// invalidate the development/release worker just like changes to app modules.
const normalizedWorker = worker.replace(
  /const CACHE_NAME\s*=\s*['"][^'"]+['"];/,
  "const CACHE_NAME = '__PAINT_CACHE_NAME__';",
).replace(/const SHELL = \[[\s\S]*?\];/, 'const SHELL = __PAINT_SHELL__;');
shellHash.update(normalizedWorker);
const cacheDigest = shellHash.digest('hex').slice(0, 8);
const expectedCacheName = `paint-shell-v${version.replace(/\./g, '-')}-${cacheDigest}`;

const currentCacheName = worker.match(/const CACHE_NAME\s*=\s*['"]([^'"]+)['"];/) ?.[1];
const cacheDrift = currentCacheName !== expectedCacheName
  ? `cache name ${currentCacheName} should be ${expectedCacheName}`
  : null;

if (!missing.length && !stale.length && !cacheDrift) {
  console.log(`Service worker is in sync: version ${version}, ${existingShell.length} shell assets, ${appModules.length} app modules.`);
  process.exit(0);
}

if (checkOnly) {
  console.error('Service worker is out of sync:');
  if (cacheDrift) console.error(`- ${cacheDrift} (fix: npm run version:sync)`);
  missing.forEach((asset) => console.error(`- shell omits app module: ${asset}`));
  stale.forEach((asset) => console.error(`- shell lists a missing file: ${asset}`));
  console.error('\nFix: npm run sw:sync');
  process.exit(1);
}

const indented = nextShell.map((asset) => `  '${asset}',`).join('\n');

let updated = worker.replace(shellMatch[0], `${shellMatch[1]}\n${indented}\n${shellMatch[3]}`);
updated = updated.replace(
  /const CACHE_NAME\s*=\s*['"][^'"]+['"];/,
  `const CACHE_NAME = '${expectedCacheName}';`,
);
fs.writeFileSync(workerPath, updated);

console.log(`Service worker synced to version ${version}: +${missing.length} module(s)${stale.length ? `, -${stale.length} stale entry/entries` : ''}.`);
missing.forEach((asset) => console.log(`  + ${asset}`));
stale.forEach((asset) => console.log(`  - ${asset}`));
if (cacheDrift) console.log(`  cache name ${currentCacheName} -> ${expectedCacheName}`);