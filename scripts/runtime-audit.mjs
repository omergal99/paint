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
const toolManagerSource = fs.readFileSync(path.join(root, 'js/tools/ToolManager.js'), 'utf8');
const viewportSource = fs.readFileSync(path.join(root, 'js/canvas/ViewportManager.js'), 'utf8');
const telemetrySource = fs.readFileSync(path.join(root, 'js/telemetry.js'), 'utf8');
const storageSource = fs.readFileSync(path.join(root, 'js/storage.js'), 'utf8');
const historySource = fs.readFileSync(path.join(root, 'js/history/HistoryManager.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
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
      autosaveTeardown: storageSource.includes('if (unsubscribe) unsubscribe()')
        && storageSource.includes("eventTarget.removeEventListener('paint:changed', schedule)"),
      canvasResizeTeardown: source.includes("removeEventListener('lostpointercapture', onCancel)"),
      panelLayoutTeardown: source.includes("removeEventListener('pointercancel', stop)"),
      pointerFrameCoalescing: toolManagerSource.includes('getCoalescedEvents')
        && toolManagerSource.includes('requestFrame')
        && toolManagerSource.includes('cancelFrame'),
      cachedViewportGeometry: viewportSource.includes('_canvasRect')
        && viewportSource.includes('invalidateGeometry'),
      telemetryLifecycle: telemetrySource.includes('const pause = () =>')
        && telemetrySource.includes('const destroy = () =>'),
      editorTeardown: mainSource.includes('const destroyEditor = () =>')
        && mainSource.includes('toolManager.destroy()')
        && mainSource.includes('viewportManager.destroy()')
        && mainSource.includes('historyManager.dispose()')
        && appSource.includes('destroyEditor?.()'),
    },
  },
  memoryBudget: {
    maxUndoBytes: DEFAULT_MEMORY_BUDGET.maxUndoBytes,
    maxDecodedPixels: DEFAULT_MEMORY_BUDGET.maxDecodedPixels,
    maxScratchPixels: DEFAULT_MEMORY_BUDGET.maxScratchPixels,
    storageQuotaIsSeparate: true,
  },
  storageContracts: {
    indexedDbAutosave: storageSource.includes('openWorkspaceDatabase')
      && storageSource.includes("store.put(record, WORKING_CANVAS_KEY)"),
    quotaEstimate: source.includes('navigator.storage?.estimate'),
    autosaveTeardown: storageSource.includes('if (unsubscribe) unsubscribe()')
      && storageSource.includes("eventTarget.removeEventListener('paint:changed', schedule)"),
    versionedWorkingRecord: storageSource.includes('schemaVersion: WORKING_CANVAS_SCHEMA_VERSION'),
    preEncodeLargeCanvasGuard: storageSource.includes('WORKING_CANVAS_MAX_AUTOSAVE_PIXELS'),
    historyBlobUrlRelease: historySource.includes('_releaseEntry')
      && historySource.includes('revokeObjectURL'),
  },
  limitations: [
    'Static listener counts and file-level teardown coverage are a census, not a runtime teardown proof.',
    'Browser memory includes decoded surfaces and engine internals that this report cannot measure.',
    'Run the real-browser trace and large-canvas journey for performance conclusions.',
  ],
};

const requiredContracts = [
  ...Object.entries(result.events.lifecycleContracts),
  ...Object.entries(result.storageContracts),
].filter(([, present]) => !present).map(([name]) => name);

const outputIndex = process.argv.indexOf('--output');
const outputArgument = outputIndex === -1 ? null : process.argv[outputIndex + 1];
if (outputIndex !== -1 && !outputArgument) throw new Error('--output requires a file path.');
if (outputArgument) {
  const outputPath = path.resolve(root, outputArgument);
  if (outputPath !== root && !outputPath.startsWith(`${root}${path.sep}`)) {
    throw new Error('--output must stay inside the project root.');
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`Wrote intentional audit snapshot: ${path.relative(root, outputPath)}`);
}
console.log(JSON.stringify(result, null, 2));
if (requiredContracts.length) {
  console.error(`Runtime audit: FAIL - missing contract(s): ${requiredContracts.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Runtime audit: PASS - required static contracts are present; see limitations for what still needs browser/device evidence.');
}
