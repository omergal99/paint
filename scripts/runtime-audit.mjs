import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_MEMORY_BUDGET } from '../js/storage/MemoryBudget.js';

const root = path.resolve(import.meta.dirname, '..');
const files = [];
const walk = (directory) => fs.readdirSync(path.join(root, directory), { withFileTypes: true }).forEach((entry) => {
  const relative = path.join(directory, entry.name);
  if (entry.isDirectory()) walk(relative);
  else if (entry.name.endsWith('.js')) files.push(relative);
});
walk('js');

const source = files.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const count = (pattern) => (source.match(pattern) || []).length;
const addEventListenerCalls = count(/\.addEventListener\s*\(/g);
const removeEventListenerCalls = count(/\.removeEventListener\s*\(/g);
const listenerFiles = files.map((file) => {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  return {
    file,
    adds: (text.match(/\.addEventListener\s*\(/g) || []).length,
    removes: (text.match(/\.removeEventListener\s*\(/g) || []).length,
  };
}).filter(({ adds }) => adds > 0);
const teardownFiles = listenerFiles.filter(({ removes }) => removes > 0);
const result = {
  measuredAt: new Date().toISOString(),
  node: process.version,
  source: {
    javascriptFiles: files.length,
    javascriptLines: files.reduce((total, file) => total + fs.readFileSync(path.join(root, file), 'utf8').split('\n').length, 0),
  },
  events: {
    addEventListenerCalls,
    removeEventListenerCalls,
    pointerMoveRegistrations: count(/addEventListener\s*\(\s*['"]pointermove['"]/g),
    paintChangedRegistrations: count(/addEventListener\s*\(\s*['"]paint:changed['"]/g),
    staticCallRatio: Number((removeEventListenerCalls / Math.max(1, addEventListenerCalls)).toFixed(3)),
    filesWithListeners: listenerFiles.length,
    filesWithTeardown: teardownFiles.length,
    fileTeardownCoverage: Number((teardownFiles.length / Math.max(1, listenerFiles.length)).toFixed(3)),
    lifecycleContracts: {
      eventBusDestroy: source.includes('listenersByEvent.clear()'),
      autosaveTeardown: source.includes("removeEventListener('paint:changed', save)"),
      canvasResizeTeardown: source.includes("removeEventListener('lostpointercapture', onCancel)"),
      panelLayoutTeardown: source.includes("removeEventListener('pointercancel', stop)"),
    },
  },
  memoryBudget: {
    maxUndoBytes: DEFAULT_MEMORY_BUDGET.maxUndoBytes,
    maxDecodedPixels: DEFAULT_MEMORY_BUDGET.maxDecodedPixels,
    maxScratchPixels: DEFAULT_MEMORY_BUDGET.maxScratchPixels,
    storageQuotaIsSeparate: true,
  },
  storageContracts: {
    indexedDbAutosave: source.includes('indexedDB.open'),
    quotaEstimate: source.includes('navigator.storage?.estimate'),
    autosaveTeardown: source.includes("removeEventListener('paint:changed', save)"),
  },
  limitations: [
    'Static listener counts and file-level teardown coverage are a census, not a runtime teardown proof.',
    'Browser memory includes decoded surfaces and engine internals that this report cannot measure.',
    'Run the real-browser trace and large-canvas journey for performance conclusions.',
  ],
};

const outputPath = path.join(root, 'output/quality/step-07-08-runtime-audit.json');
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
console.log(`Saved ${path.relative(root, outputPath)}`);
