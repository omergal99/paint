import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createAbortError,
  terminateChildProcess,
  throwIfAborted,
} from './process-lifecycle.mjs';
import { DEFAULT_TEST_CONFIG } from './test-config.mjs';

const delay = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

const executableCandidates = () => {
  if (process.env.CHROME_BIN) return [process.env.CHROME_BIN];
  if (process.platform === 'darwin') {
    return ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'chromium'];
  }
  if (process.platform === 'win32') {
    return [
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
      'chrome',
    ];
  }
  return ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
};

const findChrome = (timeoutMs = DEFAULT_TEST_CONFIG.chromeDiscoveryTimeoutMs) => {
  for (const candidate of executableCandidates()) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8', timeout: timeoutMs });
    if (!result.error && result.status === 0) {
      return { executable: candidate, version: result.stdout.trim() };
    }
  }
  throw new Error('Chrome/Chromium was not found. Install a browser locally or set CHROME_BIN to its executable.');
};

const waitForPageTarget = async ({
  port,
  child,
  timeoutMs,
  pollIntervalMs = DEFAULT_TEST_CONFIG.pollIntervalMs,
  signal,
}) => {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    throwIfAborted(signal);
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Chrome exited before exposing a page target (exit ${child.exitCode ?? child.signalCode}).`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal });
      if (!response.ok) throw new Error(`Chrome target list returned HTTP ${response.status}.`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch (error) {
      if (signal?.aborted) throw createAbortError(signal);
      lastError = error;
    }
    await delay(pollIntervalMs);
  }
  throw new Error(`Timed out waiting for a Chrome page target${lastError ? `: ${lastError.message}` : '.'}`);
};

export const launchHeadlessChrome = async ({
  discoveryTimeoutMs = DEFAULT_TEST_CONFIG.chromeDiscoveryTimeoutMs,
  timeoutMs = DEFAULT_TEST_CONFIG.chromeStartupTimeoutMs,
  pollIntervalMs = DEFAULT_TEST_CONFIG.pollIntervalMs,
  shutdownGraceMs = DEFAULT_TEST_CONFIG.processShutdownGraceMs,
  signal,
} = {}) => {
  const { executable, version } = findChrome(discoveryTimeoutMs);
  throwIfAborted(signal);
  const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'local-browser-test-'));
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-component-update',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    `--user-data-dir=${profileDirectory}`,
    'about:blank',
  ];
  const child = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let output = '';
  let resolvePort;
  let rejectPort;
  let browserWebSocketUrl = null;
  const portReady = new Promise((resolve, reject) => {
    resolvePort = resolve;
    rejectPort = reject;
  });
  const onAbort = () => rejectPort(createAbortError(signal));
  signal?.addEventListener('abort', onAbort, { once: true });
  const consumeOutput = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-8000);
    const match = output.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:(\d+)\/devtools\/browser\/[^\s]+)/);
    if (match) {
      browserWebSocketUrl = match[1];
      resolvePort(Number(match[2]));
    }
  };
  child.stderr.on('data', consumeOutput);
  child.once('error', (error) => rejectPort(new Error(`Could not launch Chrome: ${error.message}`)));
  child.once('exit', (code, signal) => {
    rejectPort(new Error(`Chrome exited before startup (exit ${code ?? signal}). ${output.slice(-1200)}`));
  });

  let startupTimer;
  try {
    if (signal?.aborted) onAbort();
    const port = await Promise.race([
      portReady,
      new Promise((resolve, reject) => {
        startupTimer = setTimeout(() => reject(new Error(`Chrome did not start within ${timeoutMs}ms. ${output.slice(-1200)}`)), timeoutMs);
      }),
    ]);
    throwIfAborted(signal);
    const target = await waitForPageTarget({ port, child, timeoutMs, pollIntervalMs, signal });
    throwIfAborted(signal);

    const close = async () => {
      try {
        await terminateChildProcess({ child, timeoutMs: shutdownGraceMs });
      } finally {
        fs.rmSync(profileDirectory, { recursive: true, force: true });
      }
    };

    return Object.freeze({
      executable,
      version,
      browserWebSocketUrl,
      pageWebSocketUrl: target.webSocketDebuggerUrl,
      close,
    });
  } catch (error) {
    let cleanupError = null;
    try {
      await terminateChildProcess({ child, timeoutMs: shutdownGraceMs });
    } catch (failure) {
      cleanupError = failure;
    }
    try {
      fs.rmSync(profileDirectory, { recursive: true, force: true });
    } catch (failure) {
      cleanupError = cleanupError
        ? new AggregateError([cleanupError, failure], 'Chrome startup cleanup failed.')
        : failure;
    } finally {
      signal?.removeEventListener('abort', onAbort);
      clearTimeout(startupTimer);
    }
    if (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Chrome startup failed and cleanup also failed.');
    }
    throw error;
  } finally {
    if (!signal?.aborted) signal?.removeEventListener('abort', onAbort);
    clearTimeout(startupTimer);
  }
};
