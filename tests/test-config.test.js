import assert from 'node:assert/strict';
import test from 'node:test';
import { configToEnvironment, createTestConfig } from './core/test-config.mjs';

test('browser environment defaults and overrides are validated and passed to test processes', () => {
  const config = createTestConfig({
    projectOverrides: {
      locale: 'he-IL',
      timezoneId: 'Asia/Jerusalem',
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
      deviceScaleFactor: 2,
    },
    env: {},
  });
  assert.deepEqual(
    {
      locale: config.locale,
      timezoneId: config.timezoneId,
      colorScheme: config.colorScheme,
      reducedMotion: config.reducedMotion,
      deviceScaleFactor: config.deviceScaleFactor,
    },
    {
      locale: 'he-IL',
      timezoneId: 'Asia/Jerusalem',
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
      deviceScaleFactor: 2,
    },
  );
  assert.equal(configToEnvironment(config).LOCAL_BROWSER_LOCALE, 'he-IL');
  assert.equal(configToEnvironment(config).LOCAL_BROWSER_DEVICE_SCALE_FACTOR, '2');
  assert.throws(() => createTestConfig({ projectOverrides: { colorScheme: 'sepia' } }), /colorScheme/);
  assert.throws(() => createTestConfig({ projectOverrides: { reducedMotion: 'sometimes' } }), /reducedMotion/);
  assert.throws(() => createTestConfig({ projectOverrides: { deviceScaleFactor: 0 } }), /deviceScaleFactor/);
});
