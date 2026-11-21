import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { terminateChildProcess } from './core/process-lifecycle.mjs';

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

