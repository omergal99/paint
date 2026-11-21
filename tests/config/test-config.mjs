export const DEFAULT_TEST_CONFIG = Object.freeze({
  chromeDiscoveryTimeoutMs: 3000,
  chromeStartupTimeoutMs: 12000,
  serverReadyTimeoutMs: 10000,
  browserCommandTimeoutMs: 5000,
  browserCloseTimeoutMs: 250,
  appReadyTimeoutMs: 12000,
  uiConditionTimeoutMs: 12000,
  testExecutionTimeoutMs: 30000,
  pollIntervalMs: 50,
  processShutdownGraceMs: 2000,
  deviceScaleFactor: 1,
  locale: 'en-US',
  timezoneId: 'UTC',
  colorScheme: 'light',
  reducedMotion: 'reduce',
  artifactDirectory: 'output/test-artifacts',
  screenshotOnFailure: true,
  diagnosticScreenshots: false,
});

const ENV_KEYS = Object.freeze({
  chromeDiscoveryTimeoutMs: 'LOCAL_BROWSER_CHROME_DISCOVERY_TIMEOUT_MS',
  chromeStartupTimeoutMs: 'LOCAL_BROWSER_CHROME_TIMEOUT_MS',
  serverReadyTimeoutMs: 'LOCAL_BROWSER_SERVER_TIMEOUT_MS',
  browserCommandTimeoutMs: 'LOCAL_BROWSER_COMMAND_TIMEOUT_MS',
  browserCloseTimeoutMs: 'LOCAL_BROWSER_CLOSE_TIMEOUT_MS',
  appReadyTimeoutMs: 'LOCAL_BROWSER_APP_TIMEOUT_MS',
  uiConditionTimeoutMs: 'LOCAL_BROWSER_UI_TIMEOUT_MS',
  testExecutionTimeoutMs: 'LOCAL_BROWSER_TEST_TIMEOUT_MS',
  pollIntervalMs: 'LOCAL_BROWSER_POLL_INTERVAL_MS',
  processShutdownGraceMs: 'LOCAL_BROWSER_SHUTDOWN_GRACE_MS',
  deviceScaleFactor: 'LOCAL_BROWSER_DEVICE_SCALE_FACTOR',
  locale: 'LOCAL_BROWSER_LOCALE',
  timezoneId: 'LOCAL_BROWSER_TIMEZONE',
  colorScheme: 'LOCAL_BROWSER_COLOR_SCHEME',
  reducedMotion: 'LOCAL_BROWSER_REDUCED_MOTION',
  artifactDirectory: 'LOCAL_BROWSER_ARTIFACT_DIR',
});

const validateDuration = (key, value) => {
  if (!Number.isInteger(value) || value < 1 || value > 600000) {
    throw new Error(`${key} must be an integer between 1 and 600000 milliseconds.`);
  }
  return value;
};

const applyOverrides = (config, overrides) => {
  for (const [key, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(config, key)) throw new Error(`Unknown browser test configuration option: ${key}`);
    if (key === 'artifactDirectory') {
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error('artifactDirectory must be a non-empty path string.');
      }
      config[key] = value;
    } else if (key === 'locale' || key === 'timezoneId') {
      if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${key} must be a non-empty string.`);
      }
      config[key] = value;
    } else if (key === 'colorScheme') {
      if (!['light', 'dark', 'no-preference'].includes(value)) {
        throw new Error('colorScheme must be light, dark, or no-preference.');
      }
      config[key] = value;
    } else if (key === 'reducedMotion') {
      if (!['reduce', 'no-preference'].includes(value)) {
        throw new Error('reducedMotion must be reduce or no-preference.');
      }
      config[key] = value;
    } else if (key === 'screenshotOnFailure' || key === 'diagnosticScreenshots') {
      if (typeof value !== 'boolean') throw new Error(`${key} must be a boolean.`);
      config[key] = value;
    } else if (key === 'deviceScaleFactor') {
      const factor = Number(value);
      if (!Number.isFinite(factor) || factor <= 0) {
        throw new Error('deviceScaleFactor must be a positive finite number.');
      }
      config[key] = factor;
    } else {
      config[key] = validateDuration(key, Number(value));
    }
  }
};

export const createTestConfig = ({
  env = process.env,
  projectOverrides = {},
  overrides = {},
} = {}) => {
  const config = { ...DEFAULT_TEST_CONFIG };
  applyOverrides(config, projectOverrides);
  for (const [key, envName] of Object.entries(ENV_KEYS)) {
    const raw = env[envName];
    if (raw === undefined || raw === '') continue;
    applyOverrides(config, { [key]: raw });
  }
  for (const key of ['screenshotOnFailure', 'diagnosticScreenshots']) {
    const envName = key === 'screenshotOnFailure'
      ? 'LOCAL_BROWSER_SCREENSHOT_ON_FAILURE'
      : 'LOCAL_BROWSER_DIAGNOSTIC_SCREENSHOTS';
    const raw = env[envName];
    if (raw === undefined || raw === '') continue;
    if (raw !== 'true' && raw !== 'false') {
      throw new Error(`${envName} must be "true" or "false".`);
    }
    config[key] = raw === 'true';
  }

  applyOverrides(config, overrides);

  if (!config.artifactDirectory.trim()) {
    throw new Error('artifactDirectory must not be empty.');
  }
  return Object.freeze(config);
};

export const configToEnvironment = (config) => Object.freeze({
  LOCAL_BROWSER_CHROME_DISCOVERY_TIMEOUT_MS: String(config.chromeDiscoveryTimeoutMs),
  LOCAL_BROWSER_CHROME_TIMEOUT_MS: String(config.chromeStartupTimeoutMs),
  LOCAL_BROWSER_SERVER_TIMEOUT_MS: String(config.serverReadyTimeoutMs),
  LOCAL_BROWSER_COMMAND_TIMEOUT_MS: String(config.browserCommandTimeoutMs),
  LOCAL_BROWSER_CLOSE_TIMEOUT_MS: String(config.browserCloseTimeoutMs),
  LOCAL_BROWSER_APP_TIMEOUT_MS: String(config.appReadyTimeoutMs),
  LOCAL_BROWSER_UI_TIMEOUT_MS: String(config.uiConditionTimeoutMs),
  LOCAL_BROWSER_TEST_TIMEOUT_MS: String(config.testExecutionTimeoutMs),
  LOCAL_BROWSER_POLL_INTERVAL_MS: String(config.pollIntervalMs),
  LOCAL_BROWSER_SHUTDOWN_GRACE_MS: String(config.processShutdownGraceMs),
  LOCAL_BROWSER_DEVICE_SCALE_FACTOR: String(config.deviceScaleFactor),
  LOCAL_BROWSER_LOCALE: config.locale,
  LOCAL_BROWSER_TIMEZONE: config.timezoneId,
  LOCAL_BROWSER_COLOR_SCHEME: config.colorScheme,
  LOCAL_BROWSER_REDUCED_MOTION: config.reducedMotion,
  LOCAL_BROWSER_ARTIFACT_DIR: config.artifactDirectory,
  LOCAL_BROWSER_SCREENSHOT_ON_FAILURE: String(config.screenshotOnFailure),
  LOCAL_BROWSER_DIAGNOSTIC_SCREENSHOTS: String(config.diagnosticScreenshots),
});

