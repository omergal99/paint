import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { terminateChildProcess } from './process-lifecycle.mjs';

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

const findChrome = () => {
  for (const candidate of executableCandidates()) {
    const result = spawnSync(candidate, ['--version'], { encoding: 'utf8', timeout: 3000 });
    if (!result.error && result.status === 0) return candidate;
  }
  throw new Error('Chrome/Chromium was not found. Install a browser locally or set CHROME_BIN to its executable.');
};

const waitForPageTarget = async ({ port, child, timeoutMs }) => {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Chrome exited before exposing a page target (exit ${child.exitCode ?? child.signalCode}).`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (!response.ok) throw new Error(`Chrome target list returned HTTP ${response.status}.`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page;
    } catch (error) {
      lastError = error;
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for a Chrome page target${lastError ? `: ${lastError.message}` : '.'}`);
};

export const launchHeadlessChrome = async ({ timeoutMs = 12000 } = {}) => {
  const executable = findChrome();
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
  const portReady = new Promise((resolve, reject) => {
    resolvePort = resolve;
    rejectPort = reject;
  });
  const consumeOutput = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-8000);
    const match = output.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\/devtools\/browser\//);
    if (match) resolvePort(Number(match[1]));
  };
  child.stderr.on('data', consumeOutput);
  child.once('error', (error) => rejectPort(new Error(`Could not launch Chrome: ${error.message}`)));
  child.once('exit', (code, signal) => {
    rejectPort(new Error(`Chrome exited before startup (exit ${code ?? signal}). ${output.slice(-1200)}`));
  });

  let startupTimer;
  try {
    const port = await Promise.race([
      portReady,
      new Promise((resolve, reject) => {
        startupTimer = setTimeout(() => reject(new Error(`Chrome did not start within ${timeoutMs}ms. ${output.slice(-1200)}`)), timeoutMs);
      }),
    ]);
    clearTimeout(startupTimer);
    const target = await waitForPageTarget({ port, child, timeoutMs });

    const close = async () => {
      await terminateChildProcess({ child });
      fs.rmSync(profileDirectory, { recursive: true, force: true });
    };

    return Object.freeze({
      executable,
      pageWebSocketUrl: target.webSocketDebuggerUrl,
      close,
    });
  } catch (error) {
    clearTimeout(startupTimer);
    await terminateChildProcess({ child });
    fs.rmSync(profileDirectory, { recursive: true, force: true });
    throw error;
  }
};
