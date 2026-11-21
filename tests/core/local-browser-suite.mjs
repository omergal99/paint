import { spawn } from 'node:child_process';
import { launchHeadlessChrome } from './chrome-launcher.mjs';

const runTestProcess = ({ cwd, testFiles, env }) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['--test', '--test-concurrency=1', ...testFiles], {
    cwd,
    env,
    stdio: 'inherit',
  });
  const forwardInterrupt = () => child.kill('SIGINT');
  process.once('SIGINT', forwardInterrupt);
  child.once('error', (error) => {
    process.off('SIGINT', forwardInterrupt);
    reject(new Error(`Could not start browser tests: ${error.message}`));
  });
  child.once('exit', (code, signal) => {
    process.off('SIGINT', forwardInterrupt);
    if (signal) resolve(1);
    else resolve(code ?? 1);
  });
});

export const runLocalBrowserSuite = async ({
  cwd,
  startServer,
  testFiles,
  artifactsDirectory,
} = {}) => {
  if (!cwd || typeof startServer !== 'function' || !Array.isArray(testFiles) || testFiles.length === 0) {
    throw new Error('Local browser suite requires cwd, startServer, and at least one test file.');
  }

  let server;
  let chrome;
  let suiteError;
  let exitCode = 1;
  try {
    server = await startServer();
    chrome = await launchHeadlessChrome();
    exitCode = await runTestProcess({
      cwd,
      testFiles,
      env: {
        ...process.env,
        LOCAL_BROWSER_BASE_URL: server.url,
        LOCAL_BROWSER_CDP_URL: chrome.pageWebSocketUrl,
        LOCAL_BROWSER_FAILURE_DIR: artifactsDirectory,
      },
    });
  } finally {
    try {
      await chrome?.close();
    } catch (error) {
      suiteError = suiteError || error;
    }
    try {
      await server?.close();
    } catch (error) {
      suiteError = suiteError || error;
    }
  }
  if (suiteError) throw suiteError;
  return exitCode;
};
