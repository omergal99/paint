import { spawn } from 'node:child_process';

export const startProcessServer = async ({
  command,
  args = [],
  cwd,
  readyPattern,
  timeoutMs = 10000,
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
  child.once('exit', (code, signal) => {
    rejectReady(new Error(`Local server exited before becoming ready (exit ${code ?? signal}). ${output.slice(-1200)}`));
  });

  let timer;
  try {
    const url = await Promise.race([
      ready,
      new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`Local server did not become ready within ${timeoutMs}ms. ${output.slice(-1200)}`)), timeoutMs);
      }),
    ]);
    clearTimeout(timer);
    return Object.freeze({
      url,
      close: async () => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        const exited = new Promise((resolve) => child.once('exit', resolve));
        child.kill('SIGTERM');
        await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 2000))]);
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL');
          await exited;
        }
      },
    });
  } catch (error) {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    throw error;
  }
};
