import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { BROWSER_SPECS } from './browser-specs.mjs';
import projectConfig from './browser.config.mjs';
import { startPaintServer } from './adapters/paint/server.mjs';
import { runLocalBrowserSuite, readReporterOutput, resolveReporterPath } from './core/local-browser-suite.mjs';
import { parseRunnerArguments, runnerUsage, selectBrowserSpecs } from './core/runner-cli.mjs';
import { createTestConfig } from './core/test-config.mjs';
import { createRunId, printTerminalReport, writeRunReports } from './core/test-run-report.mjs';

const projectRoot = path.resolve(import.meta.dirname, '..');

const gitCommit = () => {
  const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 2000,
  });
  return result.status === 0 ? result.stdout.trim() : null;
};

const readTestResults = async (
  runDirectory,
  selectedSpecs,
  reporterTests = [],
  runnerStderr = '',
  runnerExitCode = 0,
  infrastructureFailure = false,
) => {
  const resultsDirectory = path.join(runDirectory, 'results');
  const records = [];
  for (const spec of selectedSpecs) {
    const filePath = path.join(resultsDirectory, `${spec.id}.json`);
    try {
      records.push(JSON.parse(await fs.readFile(filePath, 'utf8')));
      continue;
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Could not read test result ${filePath}: ${error.message}`);
    }

    const runnerTest = reporterTests.find((test) => test.name?.includes(`[${spec.id}]`));
    if (infrastructureFailure) continue;
    const failed = runnerTest?.type === 'test:fail';
    const skipped = runnerTest?.type === 'test:skip' || runnerTest?.type === 'test:todo';
    const missingResult = runnerTest?.type === 'test:pass';
    const didNotStart = !runnerTest && (runnerStderr.trim() || runnerExitCode !== 0);
    if (failed || missingResult || didNotStart || skipped) {
      records.push({
        schemaVersion: 1,
        id: spec.id,
        name: spec.name,
        category: 'e2e-smoke',
        device: spec.device,
        viewport: spec.viewport,
        status: skipped ? 'skipped' : 'failed',
        durationMs: runnerTest?.durationMs ?? 0,
        failedStep: 'browser test module setup',
        steps: [],
        error: skipped ? null : runnerTest?.error || {
          name: 'TestRunnerError',
          message: missingResult
            ? `The test runner reported ${spec.id} as passed but did not write its result diagnostics.`
            : runnerStderr.trim() || `The test runner failed before ${spec.id} produced a result.`,
          stack: runnerStderr.trim() || undefined,
        },
        browserDiagnostics: null,
        screenshot: null,
      });
    }
  }
  return records;
};

const resolveFailedTests = async ({ runSelector, artifactRoot }) => {
  let runId = runSelector;
  if (runSelector === 'latest') {
    let latest;
    try {
      latest = JSON.parse(await fs.readFile(path.join(artifactRoot, 'latest.json'), 'utf8'));
    } catch (error) {
      throw new Error(`Could not read the latest browser report: ${error.message}`);
    }
    runId = latest.runId;
  }
  if (typeof runId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(runId)) {
    throw new Error('A rerun selector must be "latest" or a valid report run ID.');
  }
  let previous;
  try {
    previous = JSON.parse(await fs.readFile(path.join(artifactRoot, 'runs', runId, 'report.json'), 'utf8'));
  } catch (error) {
    throw new Error(`Could not read prior browser report ${runId}: ${error.message}`);
  }
  if (previous.schemaVersion !== 1) {
    throw new Error(`Cannot rerun report schema version ${previous.schemaVersion}; expected version 1.`);
  }
  const failedIds = [...new Set(previous.tests
    .filter((test) => test.status === 'failed')
    .map((test) => test.id))];
  if (!failedIds.length) {
    throw new Error(`Run ${runId} contains no failed browser tests to rerun.`);
  }
  const selected = BROWSER_SPECS.filter((spec) => failedIds.includes(spec.id));
  if (selected.length !== failedIds.length) {
    throw new Error(`Prior report contains unknown browser test IDs: ${failedIds.filter((id) => !selected.some((spec) => spec.id === id)).join(', ')}.`);
  }
  return { runId, specs: selected };
};

const main = async () => {
  const cli = parseRunnerArguments(process.argv.slice(2));
  if (cli.help) {
    console.log(runnerUsage);
    return;
  }
  if (cli.list) {
    console.log('Available browser tests:');
    for (const spec of BROWSER_SPECS) {
      console.log(`  ${spec.id.padEnd(16)} ${spec.name}`);
    }
    return;
  }

  if (cli.rerunFailed && (cli.specs.length || cli.test)) {
    throw new Error('Do not combine --rerun-failed with --spec or --test.');
  }
  const config = createTestConfig({
    projectOverrides: projectConfig,
    overrides: cli.overrides,
  });
  const artifactRoot = path.resolve(projectRoot, config.artifactDirectory);
  const rerun = cli.rerunFailed
    ? await resolveFailedTests({ runSelector: cli.rerunFailed, artifactRoot })
    : null;
  const selectedSpecs = rerun?.specs || selectBrowserSpecs(BROWSER_SPECS, cli);
  const runId = createRunId();
  const started = new Date();
  const runDirectory = path.join(artifactRoot, 'runs', runId);
  await fs.mkdir(runDirectory, { recursive: true });

  const suite = await runLocalBrowserSuite({
    cwd: projectRoot,
    startServer: startPaintServer,
    testSpecs: selectedSpecs,
    reporterPath: resolveReporterPath(projectRoot),
    runDirectory,
    config,
  });
  const finished = new Date();
  const parsedRuns = suite.testRuns.map((run) => ({
    ...run,
    reporter: readReporterOutput(run.stdout),
  }));
  const parseFailure = parsedRuns.find((run) => run.reporter?.parseError);
  const reporterOutput = {
    tests: parsedRuns.flatMap((run) => run.reporter?.tests || []),
    diagnostics: parsedRuns.flatMap((run) => run.reporter?.diagnostics || []),
    parseError: parseFailure?.reporter?.parseError || null,
  };
  const orphanedFailure = reporterOutput.tests.find((event) => (
    event.type === 'test:fail'
    && !selectedSpecs.some((spec) => event.name?.includes(`[${spec.id}]`))
  ));
  const unreportedRunnerFailure = parsedRuns.find((run) => (
    run.exitCode !== 0
    && !run.reporter?.tests.some((event) => event.type === 'test:fail')
  ));
  const infrastructureError = suite.infrastructureError
    || (reporterOutput.parseError
      ? new Error(`Could not parse Node test reporter output: ${reporterOutput.parseError}`)
      : null)
    || (orphanedFailure
      ? new Error(`Browser test module failed outside its test case: ${orphanedFailure.name}`)
      : null)
    || (unreportedRunnerFailure
      ? new Error(`Browser test runner ${unreportedRunnerFailure.testId} exited with code ${unreportedRunnerFailure.exitCode} without a test failure event.`)
      : null);

  const logArtifacts = {};
  for (const run of parsedRuns) {
    if (run.stdout) {
      const file = path.join(runDirectory, 'logs', `${run.testId}.node-test.json`);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, run.stdout);
      logArtifacts[`${run.testId}Reporter`] = path.relative(runDirectory, file).split(path.sep).join('/');
    }
    if (run.stderr) {
      const file = path.join(runDirectory, 'logs', `${run.testId}.stderr.txt`);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, run.stderr);
      logArtifacts[`${run.testId}Stderr`] = path.relative(runDirectory, file).split(path.sep).join('/');
    }
  }

  const runnerStderr = parsedRuns.map((run) => run.stderr).filter(Boolean).join('\n');
  const tests = await readTestResults(
    runDirectory,
    selectedSpecs,
    reporterOutput.tests,
    runnerStderr,
    suite.exitCode,
    Boolean(infrastructureError),
  );
  const passed = tests.filter((test) => test.status === 'passed').length;
  const failed = tests.filter((test) => test.status === 'failed').length;
  const skipped = tests.filter((test) => test.status === 'skipped').length;
  const status = infrastructureError || failed > 0 || suite.exitCode !== 0 ? 'failed' : 'passed';
  const report = {
    schemaVersion: 1,
    runId,
    rerunOf: rerun?.runId || null,
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs: finished.getTime() - started.getTime(),
    gitCommit: gitCommit(),
    status,
    environment: {
      node: process.version,
      browser: suite.environment.browser,
      platform: `${process.platform} ${os.release()}`,
      architecture: process.arch,
    },
    selection: selectedSpecs.map(({ id, spec }) => ({ id, spec })),
    summary: {
      total: tests.length,
      passed,
      failed,
      skipped,
      infrastructureFailures: infrastructureError ? 1 : 0,
    },
    infrastructureError: infrastructureError
      ? {
        name: infrastructureError.name,
        message: infrastructureError.message,
        stack: infrastructureError.stack,
      }
      : null,
    tests,
    diagnostics: {
      ...(reporterOutput.diagnostics.length ? { nodeTestEvents: reporterOutput.diagnostics } : {}),
      ...logArtifacts,
    },
  };
  const paths = await writeRunReports({ report, artifactRoot, runDirectory });
  printTerminalReport(report, paths, runDirectory);
  if (status !== 'passed') process.exitCode = 1;
};

try {
  await main();
} catch (error) {
  console.error(error.message);
  if (process.argv.includes('--help') || process.argv.includes('-h')) console.log(runnerUsage);
  process.exitCode = 1;
}
