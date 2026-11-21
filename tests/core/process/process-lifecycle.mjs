import { DEFAULT_TEST_CONFIG } from '../../config/test-config.mjs';

export const createAbortError = (signal) => {
  const reason = typeof signal?.reason === 'string' ? signal.reason : 'AbortSignal';
  const error = new Error(`Local browser run interrupted by ${reason}.`);
  error.name = 'AbortError';
  error.signal = reason;
  return error;
};

export const throwIfAborted = (signal) => {
  if (signal?.aborted) throw createAbortError(signal);
};

export const waitForChildExit = (child) => new Promise((resolve) => {
  if (child.exitCode !== null || child.signalCode !== null) {
    resolve();
    return;
  }
  child.once('exit', resolve);
});

export const terminateChildProcess = async ({
  child,
  timeoutMs = DEFAULT_TEST_CONFIG.processShutdownGraceMs,
} = {}) => {
  if (!child) return;
  if (!Number.isInteger(child.pid)) return;
  if (child.exitCode !== null || child.signalCode !== null) return;

  const exited = waitForChildExit(child);
  child.kill('SIGTERM');
  let timer;
  await Promise.race([
    exited,
    new Promise((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    }),
  ]);
  clearTimeout(timer);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await exited;
  }
};

