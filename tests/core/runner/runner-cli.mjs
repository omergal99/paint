const VALUE_OPTIONS = Object.freeze({
  '--spec': 'spec',
  '--test': 'test',
  '--chrome-discovery-timeout-ms': 'chromeDiscoveryTimeoutMs',
  '--chrome-timeout-ms': 'chromeStartupTimeoutMs',
  '--server-timeout-ms': 'serverReadyTimeoutMs',
  '--command-timeout-ms': 'browserCommandTimeoutMs',
  '--browser-close-timeout-ms': 'browserCloseTimeoutMs',
  '--app-timeout-ms': 'appReadyTimeoutMs',
  '--ui-timeout-ms': 'uiConditionTimeoutMs',
  '--test-timeout-ms': 'testExecutionTimeoutMs',
  '--poll-interval-ms': 'pollIntervalMs',
  '--shutdown-grace-ms': 'processShutdownGraceMs',
  '--artifact-dir': 'artifactDirectory',
});

export const parseRunnerArguments = (args = []) => {
  const parsed = { specs: [], test: null, overrides: {}, list: false, help: false, diagnostics: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--list') {
      parsed.list = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      parsed.help = true;
      continue;
    }
    if (argument === '--diagnostics') {
      parsed.diagnostics = true;
      parsed.overrides.diagnosticScreenshots = true;
      continue;
    }
    if (argument === '--rerun-failed') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Option --rerun-failed requires a run ID or "latest".');
      if (parsed.rerunFailed) throw new Error('Use --rerun-failed only once per run.');
      parsed.rerunFailed = value;
      index += 1;
      continue;
    }
    const configKey = VALUE_OPTIONS[argument];
    if (!configKey) throw new Error(`Unknown browser runner option: ${argument}`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Option ${argument} requires a value.`);
    index += 1;
    if (configKey === 'spec') {
      parsed.specs.push(...value.split(',').map((spec) => spec.toLowerCase()));
    } else if (configKey === 'test') {
      if (parsed.test) throw new Error('Use --test only once per run.');
      parsed.test = value;
    } else if (configKey === 'artifactDirectory') {
      parsed.overrides[configKey] = value;
    } else {
      parsed.overrides[configKey] = Number(value);
    }
  }
  return parsed;
};

export const selectBrowserSpecs = (specs, { specs: selectedSpecs = [], test } = {}) => {
  let selected = specs;
  if (selectedSpecs.length) {
    const invalid = selectedSpecs.filter((name) => !specs.some((spec) => spec.spec === name));
    if (invalid.length) throw new Error(`Unknown browser spec: ${invalid.join(', ')}.`);
    selected = [...new Map(
      selectedSpecs.flatMap((name) => specs
        .filter((spec) => spec.spec === name)
        .map((spec) => [spec.id, spec])),
    ).values()];
  }
  if (test) {
    const normalized = test.toLowerCase();
    selected = selected.filter((spec) => (
      spec.id.toLowerCase() === normalized || spec.name.toLowerCase() === normalized
    ));
    if (selected.length === 0) throw new Error(`No browser test matches "${test}".`);
  }
  return selected;
};

export const runnerUsage = `Usage:
  npm run test:browser
  npm run test:browser -- --spec desktop
  npm run test:browser -- --spec mobile
  npm run test:browser -- --test brush-desktop
  npm run test:browser -- --rerun-failed latest
  npm run test:browser -- --list

Options:
  --spec <desktop|mobile[,..]>  Select browser spec group
  --test <id|name>              Select one browser test
  --rerun-failed <run|latest>   Rerun tests that failed in a prior report
  --list                        List browser tests without running
  --diagnostics                 Capture screenshots after named steps
  --chrome-discovery-timeout-ms <ms> Browser binary probe maximum (default 3000)
  --chrome-timeout-ms <ms>      Chrome startup maximum (default 12000)
  --server-timeout-ms <ms>      Server readiness maximum (default 10000)
  --command-timeout-ms <ms>     CDP command maximum (default 5000)
  --browser-close-timeout-ms <ms> WebSocket close wait (default 250)
  --app-timeout-ms <ms>         App readiness maximum (default 12000)
  --ui-timeout-ms <ms>          UI condition maximum (default 12000)
  --test-timeout-ms <ms>        Per-test maximum (default 30000)
  --poll-interval-ms <ms>       Condition polling interval (default 50)
  --shutdown-grace-ms <ms>      SIGTERM grace period (default 2000)
  --artifact-dir <path>         Artifact root (default output/test-artifacts)
`;
