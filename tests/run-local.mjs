import path from 'node:path';
import { runLocalBrowserSuite } from './core/local-browser-suite.mjs';
import { startPaintServer } from './adapters/paint/server.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');
const testFiles = [
  path.join(projectRoot, 'tests/specs/desktop.browser.mjs'),
  path.join(projectRoot, 'tests/specs/mobile.browser.mjs'),
];

try {
  process.exitCode = await runLocalBrowserSuite({
    cwd: projectRoot,
    startServer: startPaintServer,
    testFiles,
    artifactsDirectory: path.join(projectRoot, 'output/test-artifacts/failures'),
  });
} catch (error) {
  console.error(`Local browser suite failed to start: ${error.message}`);
  process.exitCode = 1;
}
