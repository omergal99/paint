import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { renderHtmlReport, writeRunReports } from './core/test-run-report.mjs';

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

test('report writer creates versioned JSON, standalone HTML, and latest pointer', async () => {
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
  } finally {
    await fs.rm(artifactRoot, { recursive: true, force: true });
  }
});

