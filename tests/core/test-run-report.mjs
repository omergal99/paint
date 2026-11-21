import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const createRunId = (date = new Date()) => (
  `${date.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}-${randomUUID()}`
);

const safeArtifactPath = (value) => {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes(':')) return null;
  const segments = value.split('/');
  if (segments.some((segment) => (
    !segment || segment === '.' || segment === '..' || !/^[a-zA-Z0-9._-]+$/.test(segment)
  ))) return null;
  return value;
};

const writeAtomically = async (filePath, contents) => {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, contents, { flag: 'wx' });
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    try {
      await fs.rm(temporaryPath, { force: true });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `Could not write ${filePath} atomically or clean up its temporary file.`,
      );
    }
    throw error;
  }
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const renderTest = (test) => {
  const failed = test.status === 'failed';
  const screenshotPath = safeArtifactPath(test.screenshot);
  const error = test.error
    ? `<pre>${escapeHtml(test.error.stack || test.error.message || test.error)}</pre>`
    : '';
  const screenshot = screenshotPath
    ? `<a href="${escapeHtml(screenshotPath)}"><img src="${escapeHtml(screenshotPath)}" alt="Failure screenshot for ${escapeHtml(test.name)}"></a>`
    : '';
  const steps = test.steps?.length
    ? `<ol>${test.steps.map((step) => {
      const stepScreenshot = safeArtifactPath(step.screenshot);
      return `<li class="${step.status === 'failed' ? 'failed' : ''}"><strong>${escapeHtml(step.name)}</strong> — ${escapeHtml(step.status)} (${escapeHtml(step.durationMs)} ms) ${stepScreenshot ? `<a href="${escapeHtml(stepScreenshot)}">Screenshot</a>` : ''}</li>`;
    }).join('')}</ol>`
    : '';
  const browserDiagnostics = Object.entries(test.browserDiagnostics || {})
    .filter(([, values]) => Array.isArray(values) && values.length)
    .map(([name, values]) => `<li><strong>${escapeHtml(name)}:</strong> ${values.map(escapeHtml).join('<br>')}</li>`)
    .join('');
  const diagnostics = browserDiagnostics ? `<ul>${browserDiagnostics}</ul>` : '';
  return `<details class="test ${failed ? 'failed' : 'passed'}" ${failed ? 'open' : ''}>
    <summary><span class="badge">${failed ? 'FAIL' : test.status.toUpperCase()}</span> ${escapeHtml(test.id)} — ${escapeHtml(test.name)} <span class="muted">${escapeHtml(test.device)} · ${escapeHtml(test.durationMs)} ms</span></summary>
    ${test.failedStep ? `<p><strong>Failed step:</strong> ${escapeHtml(test.failedStep)}</p>` : ''}
    ${error}${diagnostics}${steps}${screenshot}
  </details>`;
};

export const renderHtmlReport = (report) => {
  const totals = report.summary;
  const statusClass = report.status === 'passed' ? 'passed' : 'failed';
  const tests = report.tests.map(renderTest).join('\n');
  const infra = report.infrastructureError
    ? `<section class="failed"><h2>Infrastructure failure</h2><pre>${escapeHtml(report.infrastructureError.stack || report.infrastructureError.message)}</pre></section>`
    : '';
  const artifacts = Object.entries(report.diagnostics || {})
    .map(([name, value]) => [name, safeArtifactPath(value)])
    .filter(([, value]) => value)
    .map(([name, value]) => `<li><a href="${escapeHtml(value)}">${escapeHtml(name)}</a></li>`)
    .join('');
  const embeddedJson = JSON.stringify(report).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Local E2E report ${escapeHtml(report.runId)}</title>
<style>
  :root{font:16px/1.5 system-ui,sans-serif;color:#172033;background:#f4f6fa}
  body{max-width:980px;margin:2rem auto;padding:0 1rem}
  header,section,.test{background:#fff;border:1px solid #d8deea;border-radius:12px;padding:1rem;margin:0 0 1rem}
  h1,h2,p{margin-top:0} .summary{display:flex;gap:.75rem;flex-wrap:wrap}
  .summary span,.badge{padding:.2rem .55rem;border-radius:99px;background:#edf1f7}
  .passed .badge{background:#dcf6e8;color:#146b38}.failed,.test.failed{border-color:#d23d4b}
  .failed .badge{background:#ffe0e3;color:#9b1424}.muted{color:#5d687c;font-size:.9em;margin-left:.5rem}
  summary{cursor:pointer;font-weight:650} pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6fa;padding:.8rem;border-radius:8px}
  img{display:block;max-width:100%;height:auto;border:1px solid #d8deea;border-radius:8px}
</style>
<body>
<header class="${statusClass}"><h1>Local E2E test report</h1>
<p><strong>Status:</strong> ${escapeHtml(report.status.toUpperCase())} · <strong>Run:</strong> ${escapeHtml(report.runId)}</p>
<p><strong>Started:</strong> ${escapeHtml(report.startedAt)} · <strong>Duration:</strong> ${escapeHtml(report.durationMs)} ms</p>
<div class="summary"><span>Passed: ${totals.passed}</span><span>Failed: ${totals.failed}</span><span>Skipped: ${totals.skipped}</span><span>Infrastructure failures: ${totals.infrastructureFailures}</span></div></header>
${infra}<section><h2>Browser tests</h2>${tests || '<p>No browser tests were started.</p>'}</section>
<section><h2>Environment</h2><pre>${escapeHtml(JSON.stringify(report.environment, null, 2))}</pre></section>
${artifacts ? `<section><h2>Diagnostic artifacts</h2><ul>${artifacts}</ul></section>` : ''}
<script type="application/json" id="run-report">${embeddedJson}</script>
</body></html>`;
};

export const writeRunReports = async ({ report, artifactRoot, runDirectory } = {}) => {
  await fs.mkdir(runDirectory, { recursive: true });
  const jsonPath = path.join(runDirectory, 'report.json');
  const htmlPath = path.join(runDirectory, 'report.html');
  await writeAtomically(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeAtomically(htmlPath, renderHtmlReport(report));
  await fs.mkdir(artifactRoot, { recursive: true });
  const latest = {
    schemaVersion: 1,
    runId: report.runId,
    json: path.relative(artifactRoot, jsonPath).split(path.sep).join('/'),
    html: path.relative(artifactRoot, htmlPath).split(path.sep).join('/'),
  };
  await writeAtomically(path.join(artifactRoot, 'latest.json'), `${JSON.stringify(latest, null, 2)}\n`);
  return Object.freeze({ jsonPath, htmlPath });
};

export const printTerminalReport = (report, paths, runDirectory, output = console) => {
  output.log(`\nLOCAL E2E TEST REPORT`);
  output.log(`Run ID: ${report.runId}`);
  if (report.rerunOf) output.log(`Rerun of: ${report.rerunOf}`);
  output.log(`Environment: ${report.environment.browser || 'Chromium'} / ${report.environment.platform}`);
  output.log(`Duration: ${report.durationMs} ms`);
  if (report.infrastructureError) {
    output.error(`INFRASTRUCTURE FAILURE: ${report.infrastructureError.message}`);
  }
  for (const test of report.tests) {
    const status = test.status.toUpperCase().padEnd(7);
    const device = test.device ? `${test.device} ` : '';
    output.log(`[${status}] ${test.id} ${device}${test.durationMs ?? 0} ms`);
    if (test.failedStep) output.error(`  Failed step: ${test.failedStep}`);
    if (test.error?.message) output.error(`  Error: ${test.error.message}`);
    const diagnostics = test.browserDiagnostics;
    for (const diagnostic of [
      ...(diagnostics?.uncaughtExceptions || []),
      ...(diagnostics?.consoleErrors || []),
      ...(diagnostics?.browserLogErrors || []),
      ...(diagnostics?.unexpectedNetworkRequests || []),
      ...(diagnostics?.networkFailures || []),
    ]) output.error(`  Diagnostic: ${diagnostic}`);
    if (test.screenshot) output.error(`  Screenshot: ${path.resolve(runDirectory, test.screenshot)}`);
  }
  output.log(`Passed: ${report.summary.passed} · Failed: ${report.summary.failed} · Skipped: ${report.summary.skipped}`);
  output.log(`JSON: ${paths.jsonPath}`);
  output.log(`HTML: ${paths.htmlPath}\n`);
};

