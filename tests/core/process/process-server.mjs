import { spawn } from 'node:child_process';
import { createAbortError, terminateChildProcess } from './process-lifecycle.mjs';
import { DEFAULT_TEST_CONFIG } from '../../config/test-config.mjs';

export const startProcessServer = async ({
  command,
  args = [],
  cwd,
  readyPattern,
  timeoutMs = DEFAULT_TEST_CONFIG.serverReadyTimeoutMs,
  shutdownGraceMs = DEFAULT_TEST_CONFIG.processShutdownGraceMs,
  signal,
} = {}) => {
  if (!(readyPattern instanceof RegExp)) throw new Error('A server readyPattern is required.');
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  let resolveReady;
  let rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const consumeOutput = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-8000);
    readyPattern.lastIndex = 0;
    const match = readyPattern.exec(output);
    if (match) resolveReady(match[1]);
  };
  child.stdout.on('data', consumeOutput);
  child.stderr.on('data', consumeOutput);
  child.once('error', (error) => rejectReady(new Error(`Could not start the local server: ${error.message}`)));
  child.once('exit', (code, exitSignal) => {
    rejectReady(new Error(`Local server exited before becoming ready (exit ${code ?? exitSignal}). ${output.slice(-1200)}`));
  });
  const onAbort = () => rejectReady(createAbortError(signal));
  signal?.addEventListener('abort', onAbort, { once: true });

  let timer;
  try {
    if (signal?.aborted) onAbort();
    const url = await Promise.race([
      ready,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Local server did not become ready within ${timeoutMs}ms. ${output.slice(-1200)}`)), timeoutMs);
      }),
    ]);
    return Object.freeze({
      url,
      close: async () => {
        await terminateChildProcess({ child, timeoutMs: shutdownGraceMs });
      },
    });
  } catch (error) {
    try {
      await terminateChildProcess({ child, timeoutMs: shutdownGraceMs });
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Local server startup failed and cleanup also failed.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
};
