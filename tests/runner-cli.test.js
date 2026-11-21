import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRunnerArguments, selectBrowserSpecs } from './core/runner-cli.mjs';
import { createTestConfig } from './core/test-config.mjs';

const specs = [
  { id: 'brush-desktop', name: 'Desktop Brush', spec: 'desktop' },
  { id: 'brush-mobile', name: 'Mobile Brush', spec: 'mobile' },
];

test('browser runner selects a single stable test id and lists desktop groups', () => {
  const parsed = parseRunnerArguments(['--test', 'brush-mobile']);
  assert.deepEqual(selectBrowserSpecs(specs, parsed).map((spec) => spec.id), ['brush-mobile']);
  assert.deepEqual(
    selectBrowserSpecs(specs, parseRunnerArguments(['--spec', 'desktop'])).map((spec) => spec.id),
    ['brush-desktop'],
  );
  assert.deepEqual(
    selectBrowserSpecs(specs, parseRunnerArguments(['--spec', 'mobile,desktop'])).map((spec) => spec.id),
    ['brush-mobile', 'brush-desktop'],
  );
});

test('browser runner rejects unknown selections and malformed timeout values', () => {
  assert.throws(() => selectBrowserSpecs(specs, parseRunnerArguments(['--spec', 'tablet'])), /Unknown browser spec/);
  assert.throws(() => parseRunnerArguments(['--test']), /requires a value/);
  assert.equal(parseRunnerArguments(['--rerun-failed', 'latest']).rerunFailed, 'latest');
  assert.throws(() => parseRunnerArguments(['--rerun-failed']), /requires a run ID/);
  assert.throws(() => createTestConfig({ overrides: { appReadyTimeoutMs: 0 } }), /between 1 and 600000/);
});

test('browser configuration precedence is defaults, project, environment, then CLI', () => {
  const config = createTestConfig({
    env: { LOCAL_BROWSER_UI_TIMEOUT_MS: '7000' },
    projectOverrides: { uiConditionTimeoutMs: 6000 },
    overrides: { uiConditionTimeoutMs: 8000 },
  });
  assert.equal(config.uiConditionTimeoutMs, 8000);
  assert.throws(() => createTestConfig({ projectOverrides: { unknownTimeoutMs: 5 } }), /Unknown browser test configuration/);
});

