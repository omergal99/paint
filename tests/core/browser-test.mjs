import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createTestConfig } from './test-config.mjs';

const safeName = (value) => value.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80) || 'browser-test';

const serializeError = (error) => ({
  name: error instanceof Error ? error.name : 'Error',
  message: error instanceof Error ? error.message : String(error),
  stack: error instanceof Error ? error.stack : undefined,
  code: error instanceof Error ? error.code : undefined,
});

export const createBrowserTest = ({
  test,
  browser,
  runDirectory,
  config = createTestConfig(),
} = {}) => {
  if (typeof test !== 'function' || !browser || typeof runDirectory !== 'string' || !runDirectory) {
    throw new Error('Browser tests require the Node test function, a browser session, and a run directory.');
  }

  return (metadata, run) => {
    if (!metadata?.id || !metadata?.name || !metadata?.device || typeof run !== 'function') {
      throw new Error('Browser tests require stable id, name, device, and a run callback.');
    }

    return test(`[${metadata.id}] ${metadata.name}`, { timeout: config.testExecutionTimeoutMs }, async () => {
      const startedAt = new Date();
      const start = performance.now();
      const steps = [];
      let failedStep = null;
      let screenshot = null;
      let errorInfo = null;
      let status = 'passed';
      browser.clearBrowserErrors();

      const step = async (name, action) => {
        if (typeof name !== 'string' || !name.trim() || typeof action !== 'function') {
          throw new Error('A browser step requires a name and an action.');
        }
        const stepStart = performance.now();
        const entry = { name, status: 'running', startedAt: new Date().toISOString() };
        steps.push(entry);
        try {
          await action();
          entry.status = 'passed';
          if (config.diagnosticScreenshots) {
            const fileName = `${safeName(metadata.id)}-step-${steps.length}.png`;
            await browser.captureScreenshot(path.join(runDirectory, 'screenshots', fileName));
            entry.screenshot = `screenshots/${fileName}`;
          }
        } catch (error) {
          entry.status = 'failed';
          entry.error = serializeError(error);
          failedStep = name;
          throw error;
        } finally {
          entry.durationMs = Math.round(performance.now() - stepStart);
          entry.finishedAt = new Date().toISOString();
        }
      };

      try {
        if (metadata.environment) await browser.setEnvironment(metadata.environment);
        await run({ browser, step });
        await step('Verify browser and network diagnostics', async () => {
          browser.assertNoBrowserErrors();
        });
      } catch (error) {
        status = 'failed';
        errorInfo = serializeError(error);
        if (!failedStep) failedStep = 'browser test completion';
        if (config.screenshotOnFailure) {
          const fileName = `${safeName(metadata.id)}-failure.png`;
          try {
            await browser.captureScreenshot(path.join(runDirectory, 'screenshots', fileName));
            screenshot = `screenshots/${fileName}`;
          } catch (screenshotError) {
            errorInfo.screenshotError = serializeError(screenshotError);
          }
        }
      }

      const result = {
        schemaVersion: 1,
        id: metadata.id,
        name: metadata.name,
        category: metadata.category || 'e2e-smoke',
        device: metadata.device,
        viewport: metadata.viewport,
        status,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Math.round(performance.now() - start),
        failedStep,
        steps,
        error: errorInfo,
        browserDiagnostics: browser.diagnostics(),
        screenshot,
      };
      const resultPath = path.join(runDirectory, 'results', `${safeName(metadata.id)}.json`);
      await fs.mkdir(path.dirname(resultPath), { recursive: true });
      await fs.writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
      if (errorInfo) throw new Error(errorInfo.message, { cause: errorInfo });
    });
  };
};
