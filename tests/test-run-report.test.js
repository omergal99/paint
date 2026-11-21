import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createRunId,
  printTerminalReport,
  renderHtmlReport,
  writeRunReports,
} from './core/test-run-report.mjs';

const sampleReport = {
  schemaVersion: 1,
  runId: 'report-test',
  startedAt: '2026-11-21T00:00:00.000Z',
  finishedAt: '2026-11-21T00:00:01.000Z',
  durationMs: 1000,
  gitCommit: null,
  status: 'failed',
  environment: { node: 'v24', browser: 'Chromium', platform: 'linux', architecture: 'x64' },
  selection: [],
  summary: { total: 1, passed: 0, failed: 1, skipped: 0, infrastructureFailures: 0 },
  infrastructureError: null,
  tests: [{
    id: 'report-failure',
    name: '<img src=x onerror=alert(1)>',
    category: 'e2e-smoke',
    device: 'Desktop',
    status: 'failed',
    durationMs: 20,
    failedStep: 'Open app',
    steps: [{ name: 'Draw', status: 'failed', durationMs: 5, screenshot: 'screenshots/draw.png' }],
    error: { name: 'Error', message: 'expected failure', stack: 'Error: expected failure' },
    screenshot: 'screenshots/failure.png',
  }],
  diagnostics: { stderrPath: 'logs/stderr.log' },
};

test('HTML report escapes test text and highlights failure details', () => {
  const html = renderHtmlReport(sampleReport);
  assert.match(html, /class="failed"/);
  assert.match(html, /Failed step:<\/strong> Open app/);
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /href="screenshots\/draw\.png">Screenshot/);
  assert.match(html, /href="screenshots\/failure\.png"/);
  assert.match(html, /href="logs\/stderr\.log">stderrPath/);
});

test('HTML report links only to safe relative artifact paths', () => {
  const report = structuredClone(sampleReport);
  report.tests[0].screenshot = '../../private.txt';
  report.tests[0].steps[0].screenshot = 'javascript:alert(1)';
  report.diagnostics.stderrPath = '/etc/passwd';
  const html = renderHtmlReport(report);
  assert.doesNotMatch(html, /href="(?:\.\.\/|javascript:|\/etc)/);
  assert.doesNotMatch(html, /src="(?:\.\.\/|javascript:)/);
});

test('report writer creates versioned JSON, standalone HTML, and latest pointer', async () => {
  assert.match(createRunId(), /^\d{14}-[a-f0-9-]{36}$/);
  const artifactRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'paint-e2e-report-'));
  const runDirectory = path.join(artifactRoot, 'runs', sampleReport.runId);
  try {
    const paths = await writeRunReports({ report: sampleReport, artifactRoot, runDirectory });
    const json = JSON.parse(await fs.readFile(paths.jsonPath, 'utf8'));
    const html = await fs.readFile(paths.htmlPath, 'utf8');
    const latestPath = path.join(artifactRoot, 'latest.json');
    const latest = JSON.parse(await fs.readFile(latestPath, 'utf8'));
    assert.equal(json.schemaVersion, 1);
    assert.match(html, /Local E2E test report/);
    assert.equal(latest.runId, sampleReport.runId);
    assert.equal((await fs.lstat(latestPath)).isFile(), true);
    assert.deepEqual(
      (await fs.readdir(runDirectory)).sort(),
      ['report.html', 'report.json'],
    );
  } finally {
    await fs.rm(artifactRoot, { recursive: true, force: true });
  }
});

test('terminal report retains test details when report files could not be saved', () => {
  const logged = [];
  const errors = [];
  printTerminalReport(sampleReport, null, '/tmp/report-test', {
    log: (message) => logged.push(message),
    error: (message) => errors.push(message),
  });
  assert.ok(logged.some((message) => message.includes('[FAILED ] report-failure')));
  assert.ok(errors.some((message) => message.includes('expected failure')));
  assert.ok(errors.some((message) => message.includes('partial files may remain')));
});

