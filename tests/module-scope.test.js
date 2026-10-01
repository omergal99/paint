import quieterAssert from './helpers/quieter-assert.mjs';
const assert = quieterAssert;
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { findUseBeforeDeclaration, forwardDependencies } from './helpers/module-scope.mjs';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
};

const describeHazards = (hazards) => hazards
  .map((h) => `${path.relative(root, h.file)}:${h.usedAtLine} uses '${h.name}' (declared at line ${h.declaredAtLine})`)
  .join('\n');

test('the detector reports a binding consumed before it is initialised', () => {
  // Regression shape #1: `renderSegmentedChoices` was passed into the
  // immediately invoked `initHistoryControls(...)` factory ~30 lines above the
  // multi-line `const { ... } = hydration` that initialises it. The app died at
  // startup with `Cannot access 'renderSegmentedChoices' before initialization`.
  const source = [
    "import { initHistoryControls } from './historyControls.js';",
    'const historyControls = initHistoryControls({',
    '\tsaveSettings,',
    '\trenderSegmentedChoices,',
    '});',
    'const hydration = initSettingsHydration({});',
    'const {',
    '\tapplySavedSettings,',
    '\trenderSegmentedChoices,',
    '} = hydration;',
  ].join('\n');

  const hazards = findUseBeforeDeclaration(source);
  assert.equal(hazards.length, 1);
  assert.equal(hazards[0].name, 'renderSegmentedChoices');
  assert.equal(hazards[0].usedAtLine, 4);
  assert.equal(hazards[0].declaredAtLine, 9);
});

test('the detector reports a function closing over a later declaration', () => {
  // Regression shape #2: `saveSettings` read `getDefaultZoom`, destructured from
  // `hydration` hundreds of lines below it. Its `catch` only logged a warning,
  // so settings silently stopped persisting.
  const source = [
    'const saveSettings = () => {',
    "\ttry { settingsStore.set({ defaultZoom: getDefaultZoom() }); }",
    "\tcatch (error) { console.warn('Unable to save settings:', error); }",
    '};',
    'const hydration = initSettingsHydration({});',
    'const {',
    '\tgetDefaultZoom,',
    '} = hydration;',
  ].join('\n');

  const scan = forwardDependencies(source, 'saveSettings');
  assert.equal(scan.declaredAtLine, 1);
  assert.deepEqual(scan.forward, [{ name: 'getDefaultZoom', declaredAtLine: 7 }]);
});

test('the detector stays quiet on hoisted functions and deferred bodies', () => {
  // `function` declarations hoist, so calling one above it is legal.
  assert.deepEqual(findUseBeforeDeclaration('const a = compute();\nfunction compute() { return 1; }\n'), []);
  // A reference inside a callback runs long after the module finished loading.
  assert.deepEqual(
    findUseBeforeDeclaration("const later = 1;\ndocument.addEventListener('click', () => console.log(later));\n"),
    [],
  );
  // Reading after declaration is fine, and property keys are not references.
  assert.deepEqual(findUseBeforeDeclaration('const zoom = 1;\nconst cfg = { zoom, other: zoom };\n'), []);
});

test('no module references a binding before the line that initialises it', () => {
  // Guards the whole `js/` tree, so the next extraction cannot reintroduce the
  // startup crash: any module-scope `const`/`let`/`class` consumed from code that
  // runs while the module is still evaluating is a ReferenceError waiting to fire.
  const reported = [];
  for (const file of walk(path.join(root, 'js'))) {
    for (const hazard of findUseBeforeDeclaration(fs.readFileSync(file, 'utf8'))) {
      reported.push({ ...hazard, file });
    }
  }
  assert.deepEqual(reported, [], `use before declaration:\n${describeHazards(reported)}`);
});

test('saveSettings depends only on bindings initialised above it', () => {
  // `saveSettings` is the widest-reaching writer in the app (every ribbon row,
  // Settings switch and theme change funnels through it) and it swallows its
  // own failures with a console warning. It must be structurally incapable of a
  // temporal dead zone failure.
  const scan = forwardDependencies(read('js/main.js'), 'saveSettings');
  assert.ok(scan, 'saveSettings must be a top-level binding in js/main.js');
  assert.deepEqual(
    scan.forward.map((d) => d.name),
    [],
    `saveSettings closes over bindings declared below it (defined line ${scan.declaredAtLine}): `
      + scan.forward.map((d) => `${d.name}@${d.declaredAtLine}`).join(', '),
  );
});

test('managers that notify during construction stay below their callbacks', () => {
  // `PanelLayoutManager` runs `apply()` from its constructor, and `apply()` calls
  // `onChange` synchronously. Hoisting the `new PanelLayoutManager(...)` above
  // `syncRibbonLayoutControls` therefore threw at startup even though nothing in
  // the constructor referenced it directly - the callback did.
  const main = read('js/main.js');
  const callback = main.indexOf('const syncRibbonLayoutControls =');
  const construction = main.indexOf('new PanelLayoutManager(');
  assert.ok(callback > -1 && construction > -1);
  assert.ok(
    callback < construction,
    `PanelLayoutManager must be constructed after syncRibbonLayoutControls (callback ${callback + 1}, construction ${construction + 1})`,
  );
  assert.ok(main.indexOf('const openSettingsDialog =') < construction, 'onChange also closes over openSettingsDialog');

  // `saveSettings` still reads the layout, through the late-bound accessor,
  // because it is defined long before the manager exists.
  assert.match(main, /let readRibbonLayout = \(\) => \(\{[^}]*\}\);/);
  assert.match(main, /readRibbonLayout = \(\) => \(\{ \.\.\.ribbonLayoutManager\.state \}\);/);
  assert.match(main, /ribbonLayout: readRibbonLayout\(\),/);
});

test('the settings save path reads helpers that exist from module start', () => {
  // `getDefaultZoom` used to be produced by a late factory call. It is now a
  // plain module export, so importing it is initialised before any code runs.
  const main = read('js/main.js');
  assert.match(main, /import \{ initSettingsHydration, getDefaultZoom \} from '\.\/app\/settingsHydration\.js';/);
  assert.match(read('js/app/settingsHydration.js'), /export const getDefaultZoom = \(\) => \{/);
  // It must no longer be pulled out of the late `hydration` destructure.
  assert.doesNotMatch(main, /const \{[\s\S]*?getDefaultZoom,[\s\S]*?\} = hydration;/);

  // Segmented choices have a single owner, so history controls no longer need
  // one injected - which is what removed the startup dependency cycle.
  const historyControls = read('js/app/historyControls.js');
  assert.match(historyControls, /import \{ renderSegmentedChoices \} from '\.\.\/ui\/segmentedChoices\.js';/);
  assert.doesNotMatch(historyControls, /^\s*renderSegmentedChoices,$/m);

  // ...and main.js no longer passes one into that factory call. Bound the slice
  // to the argument list: a greedy match would span the whole file.
  const callStart = main.indexOf('initHistoryControls({');
  assert.ok(callStart > -1, 'main.js must still call initHistoryControls');
  const args = main.slice(callStart, main.indexOf('});', callStart));
  assert.doesNotMatch(args, /renderSegmentedChoices/);
});