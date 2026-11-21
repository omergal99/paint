import { spawn } from 'node:child_process';
import path from 'node:path';
import { launchHeadlessChrome } from '../browser/chrome-launcher.mjs';
import { configToEnvironment } from '../../config/test-config.mjs';
import {
  createAbortError,
  terminateChildProcess,
  throwIfAborted,
} from '../process/process-lifecycle.mjs';
import { createBrowserTargetFactory } from '../browser/browser-targets.mjs';

const MAX_CAPTURED_OUTPUT = 2_000_000;

const appendOutput = (current, chunk) => `${current}${chunk.toString()}`.slice(-MAX_CAPTURED_OUTPUT);

const runTestProcess = ({
  cwd,
  testFile,
  env,
  reporterPath,
  timeoutMs,
  shutdownGraceMs,
  signal,
}) => new Promise((resolve) => {
  const child = spawn(process.execPath, [
    '--test',
    '--test-concurrency=1',
    `--test-reporter=${reporterPath}`,
    testFile,
  ], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let spawnError = null;
  let timedOut = false;
  let timeoutCleanup = Promise.resolve();
  let abortTimer;
  const onAbort = () => {
    clearTimeout(timer);
    child.kill(signal.reason === 'SIGTERM' ? 'SIGTERM' : 'SIGINT');
    abortTimer = setTimeout(() => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      timeoutCleanup = terminateChildProcess({ child, timeoutMs: shutdownGraceMs })
        .catch((error) => { spawnError ||= error; });
    }, shutdownGraceMs);
  };
  const timer = setTimeout(() => {
    timedOut = true;
    timeoutCleanup = terminateChildProcess({ child, timeoutMs: shutdownGraceMs });
  }, timeoutMs);
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();
  child.stdout.on('data', (chunk) => { stdout = appendOutput(stdout, chunk); });
  child.stderr.on('data', (chunk) => { stderr = appendOutput(stderr, chunk); });
  child.once('error', (error) => { spawnError = error; });
  child.once('close', async (code, exitSignal) => {
    clearTimeout(timer);
    clearTimeout(abortTimer);
    try {
      await timeoutCleanup;
    } catch (error) {
      spawnError ||= error;
    }
    signal?.removeEventListener('abort', onAbort);
    resolve({
      exitCode: timedOut || exitSignal ? 1 : code ?? 1,
      signal: exitSignal,
      spawnError: spawnError
        ? new Error(`Could not start browser tests: ${spawnError.message}`)
        : timedOut ? new Error(`Browser test process exceeded ${timeoutMs}ms.`) : null,
      stdout,
      stderr,
    });
  });
});

export const runLocalBrowserSuite = async ({
  cwd,
  startServer,
  testSpecs,
  reporterPath,
  runDirectory,
  config,
  signal,
} = {}) => {
  if (!cwd || typeof startServer !== 'function' || !Array.isArray(testSpecs) || testSpecs.length === 0) {
    throw new Error('Local browser suite requires cwd, startServer, and at least one test spec.');
  }

  let server;
  let chrome;
  let browserTargets;
  let infrastructureError = null;
  const testRuns = [];
  try {
    throwIfAborted(signal);
    server = await startServer({
      timeoutMs: config.serverReadyTimeoutMs,
      shutdownGraceMs: config.processShutdownGraceMs,
      signal,
    });
    throwIfAborted(signal);
    chrome = await launchHeadlessChrome({
      discoveryTimeoutMs: config.chromeDiscoveryTimeoutMs,
      timeoutMs: config.chromeStartupTimeoutMs,
      pollIntervalMs: config.pollIntervalMs,
      shutdownGraceMs: config.processShutdownGraceMs,
      signal,
    });
    throwIfAborted(signal);
    browserTargets = await createBrowserTargetFactory({
      browserWebSocketUrl: chrome.browserWebSocketUrl,
      commandTimeoutMs: config.browserCommandTimeoutMs,
      closeTimeoutMs: config.browserCloseTimeoutMs,
      timeoutMs: config.chromeStartupTimeoutMs,
      pollIntervalMs: config.pollIntervalMs,
    });
    throwIfAborted(signal);
    for (const spec of testSpecs) {
      throwIfAborted(signal);
      const page = await browserTargets.openPage();
      try {
        const testRun = await runTestProcess({
          cwd,
          testFile: spec.file,
          reporterPath,
          timeoutMs: config.testExecutionTimeoutMs + config.processShutdownGraceMs,
          shutdownGraceMs: config.processShutdownGraceMs,
          signal,
          env: {
            ...process.env,
            ...configToEnvironment(config),
            LOCAL_BROWSER_BASE_URL: server.url,
            LOCAL_BROWSER_CDP_URL: page.webSocketUrl,
            LOCAL_BROWSER_RUN_DIR: runDirectory,
          },
        });
        testRuns.push({ testId: spec.id, ...testRun });
        if (signal?.aborted) {
          infrastructureError ||= createAbortError(signal);
          break;
        }
        if (testRun.spawnError) {
          infrastructureError = testRun.spawnError;
          break;
        }
      } finally {
        await page.close();
      }
    }
  } catch (error) {
    infrastructureError ||= error;
  } finally {
    try {
      await browserTargets?.close();
    } catch (error) {
      infrastructureError ||= new Error(`Browser target cleanup failed: ${error.message}`, { cause: error });
    }
    try {
      await chrome?.close();
    } catch (error) {
      infrastructureError ||= new Error(`Chrome cleanup failed: ${error.message}`, { cause: error });
    }
    try {
      await server?.close();
    } catch (error) {
      infrastructureError ||= new Error(`Server cleanup failed: ${error.message}`, { cause: error });
    }
  }

  if (signal?.aborted) infrastructureError ||= createAbortError(signal);
  const failedTestRun = testRuns.some((run) => run.exitCode !== 0);
  const signalName = signal?.aborted ? signal.reason : null;
  return Object.freeze({
    exitCode: signalName === 'SIGINT' ? 130 : signalName === 'SIGTERM' ? 143 : infrastructureError || failedTestRun ? 1 : 0,
    infrastructureError,
    signal: signalName,
    testRuns,
    environment: Object.freeze({
      browser: chrome ? `${path.basename(chrome.executable)} ${chrome.version}` : null,
      serverUrl: server?.url || null,
      locale: config.locale,
      timezoneId: config.timezoneId,
      colorScheme: config.colorScheme,
      reducedMotion: config.reducedMotion,
      deviceScaleFactor: config.deviceScaleFactor,
    }),
  });
};

export const readReporterOutput = (stdout) => {
  if (!stdout.trim()) return null;
  try {
    return JSON.parse(stdout);
  } catch (error) {
    return { schemaVersion: 1, parseError: error.message, raw: stdout.slice(-20000) };
  }
};

export const resolveReporterPath = (root) => path.join(root, 'tests/core/reporting/json-test-reporter.mjs');
