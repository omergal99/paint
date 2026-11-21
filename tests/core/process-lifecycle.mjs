const delay = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

export const waitForChildExit = (child) => new Promise((resolve) => {
  if (child.exitCode !== null || child.signalCode !== null) {
    resolve();
    return;
  }
  child.once('exit', resolve);
});

export const terminateChildProcess = async ({ child, timeoutMs = 2000 } = {}) => {
  if (!child) return;
  if (child.exitCode !== null || child.signalCode !== null) return;

  const exited = waitForChildExit(child);
  child.kill('SIGTERM');
  await Promise.race([exited, delay(timeoutMs)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await exited;
  }
};

