import quieterAssert from '../../helpers/quieter-assert.mjs';
const assert = quieterAssert;
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../../../');
const tscBin = path.join(root, 'node_modules', '.bin', 'tsc');

// `js/main.js` is deliberately excluded from jsconfig.json's typecheck include
// list (it is far too dynamic for full `checkJs`), so nothing else ever looked
// at it. That gap shipped two startup crashes: `zoomInput` and `appNameEntry`
// were bare top-level references that threw `ReferenceError: ... is not
// defined` the moment the module evaluated. Those are `TS2304: Cannot find
// name`, a *different* bug class from the temporal-dead-zone failures that
// tests/unit/app/module-scope.test.js already guards: the identifier is declared
// nowhere, so there is no later declaration line to compare against.
//
// TypeScript reports TS2304 with near-perfect precision here — across ~3200
// incidental type errors in main.js it flagged exactly the three genuine
// undeclared references (and nothing else), so we scan for that one code.
const TSC_FLAGS = [
  '--noEmit', '--allowJs', '--checkJs',
  '--target', 'ES2022',
  '--module', 'NodeNext', '--moduleResolution', 'NodeNext',
  '--lib', 'ES2022,DOM,DOM.Iterable',
];

const runTsc = (entry) => {
  try {
    execFileSync(tscBin, [...TSC_FLAGS, entry], { cwd: root, encoding: 'utf8' });
    return '';
  } catch (error) {
    // tsc exits non-zero when it finds errors; the report is on stdout.
    return `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
};

const undeclaredReferences = (report) => report
  .split('\n')
  .filter((line) => line.includes('error TS2304:'));

test('the TS2304 scanner actually reports an undeclared reference', () => {
  // Positive control: prove the harness can fail. If tsc's output format
  // changes, or the binary is missing, or flags stop enabling `checkJs`, this
  // assertion trips instead of letting the real test pass vacuously.
  const probe = path.join(os.tmpdir(), `tsc-undeclared-probe-${process.pid}.mjs`);
  fs.writeFileSync(probe, [
    "const realThing = 1;",
    'someUndeclaredGlobal?.addEventListener("x", () => realThing);',
    '',
  ].join('\n'));
  try {
    const hits = undeclaredReferences(runTsc(probe));
    assert.equal(hits.length, 1, `expected the probe to raise TS2304, got:\n${hits.join('\n') || '(none)'}`);
    assert.match(hits[0], /someUndeclaredGlobal/);
  } finally {
    fs.rmSync(probe, { force: true });
  }
});

test('js/main.js declares every identifier it references (no boot ReferenceError)', () => {
  // Runs the whole boot graph from the entry point, so a bare reference in any
  // module reached during startup is caught before it reaches a user. This is
  // the guard that would have failed the build for both v1.9.1 crashes.
  const hits = undeclaredReferences(runTsc(path.join('js', 'main.js')));
  assert.deepEqual(
    hits,
    [],
    `undeclared identifier(s) — startup ReferenceError waiting to fire:\n${hits.join('\n')}`,
  );
});
