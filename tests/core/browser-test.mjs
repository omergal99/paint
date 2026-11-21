import path from 'node:path';

const safeName = (value) => value.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 80) || 'browser-test';

export const createBrowserTest = ({ test, browser, artifactsDirectory } = {}) => {
  if (typeof test !== 'function' || !browser || typeof artifactsDirectory !== 'string' || !artifactsDirectory) {
    throw new Error('Browser tests require the Node test function, a browser session, and an artifact directory.');
  }

  return (name, run) => test(name, { timeout: 30000 }, async () => {
    browser.clearBrowserErrors();
    try {
      await run(browser);
      browser.assertNoBrowserErrors();
    } catch (error) {
      let screenshotMessage = '';
      try {
        const screenshot = await browser.captureScreenshot(path.join(artifactsDirectory, `${safeName(name)}.png`));
        screenshotMessage = `\nFailure screenshot: ${screenshot}`;
      } catch (screenshotError) {
        screenshotMessage = `\nFailure screenshot could not be captured: ${screenshotError.message}`;
      }
      const originalMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`${originalMessage}${screenshotMessage}`, { cause: error });
    }
  });
};
