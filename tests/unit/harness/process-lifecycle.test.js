import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { startPaintServer } from '../../adapters/paint/server.mjs';
import { terminateChildProcess } from '../../core/process/process-lifecycle.mjs';
import { startProcessServer } from '../../core/process/process-server.mjs';

test('terminateChildProcess clears its timeout after graceful exit', async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const clearedTimers = [];
  let scheduledTimer;
  globalThis.setTimeout = (callback, timeoutMs) => {
    scheduledTimer = { callback, timeoutMs };
    return scheduledTimer;
  };
  globalThis.clearTimeout = (timer) => { clearedTimers.push(timer); };

  const child = new EventEmitter();
  child.pid = 1;
  child.exitCode = null;
  child.signalCode = null;
  child.killCalls = [];
  child.kill = (signal) => {
    child.killCalls.push(signal);
    child.exitCode = 0;
    child.emit('exit', 0, null);
    return true;
  };
  try {
    await terminateChildProcess({ child });
    await terminateChildProcess({ child });
    assert.deepEqual(clearedTimers, [scheduledTimer]);
    assert.deepEqual(child.killCalls, ['SIGTERM']);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test('terminateChildProcess returns immediately for an already-exited child', async () => {
  const child = new EventEmitter();
  child.exitCode = 0;
  child.signalCode = null;
  child.killCalls = [];
  child.kill = (signal) => { child.killCalls.push(signal); return true; };

  await terminateChildProcess({ child });
  assert.deepEqual(child.killCalls, []);
});

test('terminateChildProcess escalates from SIGTERM to SIGKILL', async () => {
  const child = new EventEmitter();
  child.pid = 1;
  child.exitCode = null;
  child.signalCode = null;
  child.killCalls = [];
  child.kill = (signal) => {
    child.killCalls.push(signal);
    if (signal === 'SIGKILL') {
      child.exitCode = null;
      child.signalCode = 'SIGKILL';
      child.emit('exit', null, 'SIGKILL');
    }
    return true;
  };

  await terminateChildProcess({ child, timeoutMs: 5 });
  assert.deepEqual(child.killCalls, ['SIGTERM', 'SIGKILL']);
});

test('process server startup failure rejects and finishes child cleanup', async () => {
  await assert.rejects(
    startProcessServer({
      command: '/definitely/not/a/server',
      cwd: process.cwd(),
      readyPattern: /ready/,
      timeoutMs: 1000,
    }),
    /Could not start the local server/,
  );
});

test('process server startup cancellation rejects only after child cleanup', async () => {
  const controller = new AbortController();
  const startup = startProcessServer({
    command: process.execPath,
    args: ['-e', 'process.stdout.write("server started"); setInterval(() => {}, 1000)'],
    cwd: process.cwd(),
    readyPattern: /never-ready/,
    timeoutMs: 5000,
    shutdownGraceMs: 100,
    signal: controller.signal,
  });
  setTimeout(() => controller.abort('SIGINT'), 25);
  await assert.rejects(startup, { name: 'AbortError' });
});

test('Paint server forwards cancellation to the shared process lifecycle', async () => {
  const controller = new AbortController();
  controller.abort('SIGINT');
  await assert.rejects(
    startPaintServer({
      timeoutMs: 5000,
      shutdownGraceMs: 100,
      signal: controller.signal,
    }),
    { name: 'AbortError' },
  );
});

