import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const html = read('index.html');
const main = read('js/main.js');
const sidebar = read('js/ui/Sidebar.js');
const app = read('js/app.js');
const serviceWorker = read('sw.js');
const responsiveStyle = read('css/progressive.css');

test('Crop menu owns Remove Background', () => {
  const cropMenuStart = html.indexOf('id="btn-crop-menu"');
  const cropMenuEnd = html.indexOf('</div>', html.indexOf('aria-label="Crop options"'));
  const cropMenu = html.slice(cropMenuStart, cropMenuEnd);

  assert.ok(cropMenu.includes('id="btn-crop"'));
  assert.ok(cropMenu.includes('id="btn-remove-bg"'));
  assert.equal((html.match(/id="btn-remove-bg"/g) || []).length, 1);
  assert.ok(!/<button[^>]*class="[^"]*rbtn[^\"]*"[^>]*id="btn-remove-bg"/.test(html));
});
test('Open menu owns Open and Import options', () => {
  const openMenuStart = html.indexOf('id="btn-open-menu"');
  const openMenuEnd = html.indexOf('</div>', html.indexOf('aria-label="Open options"'));
  const openMenu = html.slice(openMenuStart, openMenuEnd);

  assert.ok(openMenu.includes('id="btn-open"'));
  assert.ok(openMenu.includes('id="btn-import"'));
  assert.equal((html.match(/id="btn-import"/g) || []).length, 1);
  assert.ok(!/<button[^>]*class="[^\"]*rbtn[^\\\"]*"[^>]*id="btn-import"/.test(html));
  assert.match(openMenu, /<svg class="icon"/);
});

test('file picker is single, hidden, and not rendered as a native control', () => {
  assert.equal((html.match(/id="file-input"/g) || []).length, 1);
  assert.match(html, /<input[^>]*id="file-input"[^>]*\shidden(?:\s|>)/);
  assert.match(read('css/progressive.css'), /#file-input\s*\{[^}]*display:\s*none\s*!important/s);
});

test('History controls expose save and clear actions', () => {
  const controls = html.match(/<div class="history-controls">([\s\S]*?)<\/div>\s*<div class="history-grid"/);
  assert.ok(controls, 'History controls markup is missing');
  assert.match(controls[1], /id="history-save-current-btn"/);
  assert.match(controls[1], /id="history-clear-btn"/);
  assert.match(sidebar, /this\.saveToHistoryBtn\.addEventListener\('click'/);
});

test('Ribbon settings cannot expose menu actions as standalone controls', () => {
  assert.match(sidebar, /filter\(\(btn\) => btn\.id !== 'btn-remove-bg' && !btn\.closest\('\.action-menu-items'\)\)/);
});

test('telemetry does not log every dropped frame', () => {
  assert.doesNotMatch(app, /console\.warn\(.*frame-drop/);
  assert.match(read('js/telemetry.js'), /frame-drop-summary/);
});

test('Text font size is driven by the shared Shapes size-select (no separate dropdown)', () => {
  // The dedicated font dropdown was removed — the Shapes size-select is the
  // single size control for both brush/line width and the text tool.
  assert.equal((html.match(/id="font-size"/g) || []).length, 0);
  assert.equal((html.match(/id="custom-font-size"/g) || []).length, 0);
  assert.equal((html.match(/id="line-size"/g) || []).length, 1);
  assert.equal((html.match(/id="custom-line-size"/g) || []).length, 1);
  // The shared control feeds BOTH the line width and the font size.
  assert.match(read('js/ui/Toolbar.js'), /_bindLineSize\(setLineWidth, setFontSize\)/);
  assert.match(read('js/ui/Toolbar.js'), /setLineWidth\(size\);\s*setFontSize\(size\)/s);
  assert.match(main, /getFontSize:\s*\(\)\s*=>\s*currentFontSize/);
});

test('Keyboard paste defers to the native paste event for macOS support', () => {
  assert.match(read('js/main.js'), /document\.addEventListener\('paste'/);
  const shortcutBlock = main.match(/window\.addEventListener\('keydown'[\s\S]*?\n\}\);\n/)?.[0] || '';
  assert.ok(!/case 'v':[\s\S]*clipboardManager\.paste\(\)/.test(shortcutBlock),
    'Cmd+V must not route through navigator.clipboard.read()');
  assert.match(read('js/clipboard/ClipboardManager.js'), /_pngBlobFromCanvas/,
    'Copy must encode the PNG synchronously to keep the Safari user gesture alive');
});

test('Zoom is persisted so a refresh keeps the last zoom level', () => {
  const vpm = read('js/canvas/ViewportManager.js');
  assert.match(vpm, /ZOOM_STORAGE_KEY/);
  assert.match(vpm, /this\.zoom\s*=\s*this\._restoreZoom\(\)/);
  assert.match(vpm, /_persistZoom\(\)/);
  assert.match(vpm, /localStorage\.setItem\(ZOOM_STORAGE_KEY/);
});

test('Settings dialog has a HISTORY tab with history controls', () => {
  assert.match(html, /data-settings-tab="history"\s*>\s*HISTORY/);
  assert.match(html, /data-settings-panel="history"/);
  assert.match(html, /id="setting-history-auto-save"/);
  assert.match(html, /id="setting-history-auto-save-mode"/);
  assert.match(html, /id="setting-history-save-limit"/);
  assert.match(html, /id="settings-history-export-all"/);
  assert.match(html, /id="settings-history-clear"/);
});

test('History auto-save toggle + export-all are wired and guarded', () => {
  assert.match(html, /id="history-auto-save-toggle"/);
  assert.match(html, /id="history-export-all-btn"/);
  assert.match(main, /shouldAutoSaveHistory\(\)/);
  assert.match(main, /shouldAutoSaveOnClose\(\)/);
  assert.match(main, /if \(shouldAutoSaveHistory\(\)\) await sidebar\.saveCurrentToHistory/);
  assert.match(main, /if \(shouldAutoSaveHistory\(\)\) sidebar\.saveCurrentToHistory/);
  assert.match(main, /if \(shouldAutoSaveOnClose\(\)\) sidebar\.saveCurrentToHistory/);
  assert.match(main, /exportAllHistory\(\)/);
});

test('Per-item history save button and export event are in place', () => {
  assert.match(sidebar, /history-save/);
  assert.match(sidebar, /paint:history-export-item/);
  assert.match(main, /paint:history-export-item/);
});

test('Plain wheel scrolls natively; only Ctrl/Cmd+wheel zooms', () => {
  const vpm = read('js/canvas/ViewportManager.js');
  const resizer = read('js/canvas/CanvasResizer.js');
  // Plain wheel must NOT zoom (it stays native so the user can scroll/pan
  // without moving the view percentage).
  assert.match(vpm, /if \(!e\.ctrlKey && !e\.metaKey\) return/);
  // Zoom still works both directions for Ctrl+wheel…
  assert.match(vpm, /this\.zoom \+ \(e\.deltaY < 0 \? STEP : -STEP\)/);
  // …and stays disabled while a canvas resize drag owns the wheel.
  assert.match(vpm, /dataset\.resizing === 'true'/);
  assert.match(resizer, /wheelAdjust/);
  assert.match(resizer, /dataset\.resizing = 'true'/);
});

test('Stage uses inner pixel box + outer scaled box for scrollbars', () => {
  const vpm = read('js/canvas/ViewportManager.js');
  const resizer = read('js/canvas/CanvasResizer.js');
  const css = read('css/styles.css');
  // The outer stage is sized to the scaled canvas so scrollbars match the view.
  assert.match(vpm, /syncStageSize\(\)/);
  assert.match(vpm, /stage\.style\.width = \`\$\{w\}px\`/);
  // The inner box keeps image-pixel sizing and carries the transform.
  assert.match(resizer, /scaleEl\.style\.width/);
  assert.match(vpm, /scaleEl\.style\.transform/);
  assert.match(html, /id="canvas-scale"/);
  assert.match(css, /\.canvas-scale\s*\{[^}]*transform-origin:\s*top\s*left/s);
  // The viewport is actually locked while a resize drag is active.
  assert.match(css, /\.prevent-scroll\s*\{[^}]*overflow:\s*hidden/s);
});

test('Arrow shape is available in the ribbon and renders in ShapeTool', () => {
  const shapeTool = read('js/tools/ShapeTool.js');
  assert.match(html, /data-shape="arrow"/);
  assert.match(html, /data-tag="shape-arrow"/);
  assert.match(shapeTool, /kind === 'arrow'/);
  assert.match(shapeTool, /drawArrowPath\(g, ctx, start, end, outlineColor\)/);
  assert.match(shapeTool, /Math\.hypot\(dx, dy\)/);
});

test('Service Worker precache entries exist', () => {
  const shellBlock = serviceWorker.match(/const SHELL = \[(.*?)\];/s)?.[1] || '';
  const assets = [...shellBlock.matchAll(/['"](.*?)['"]/g)].map((match) => match[1]);
  for (const asset of assets.filter((asset) => asset !== './')) {
    assert.ok(fs.existsSync(path.join(root, asset)), `Missing precache asset: ${asset}`);
  }
});

test('Mobile status bar stays on one line and hides app branding', () => {
  assert.match(responsiveStyle, /\.status-bar\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(responsiveStyle, /\.status-item\.app-name\s*\{\s*display:\s*none/s);
  assert.match(responsiveStyle, /\.status-bar\s*\{[^}]*overflow-x:\s*auto/s);
});

test('Action menus choose their direction from available viewport space', () => {
  assert.match(main, /spaceBelow\s*=\s*window\.innerHeight\s*-\s*bounds\.bottom/);
  assert.match(main, /openAbove\s*=\s*spaceBelow\s*<\s*menuHeight/);
  assert.match(main, /menuItems\.dataset\.direction\s*=\s*openAbove\s*\?\s*'up'\s*:\s*'down'/);
});

test('Size menu provides a responsive quick-button matrix', () => {
  const sizeOptions = [...html.matchAll(/data-size-option="(\d+)"/g)].map((match) => Number(match[1]));
  assert.ok(sizeOptions.length >= 20);
  assert.ok(sizeOptions.includes(128));
  assert.ok(sizeOptions.includes(300));
  assert.match(read('css/styles.css'), /\.size-menu-items\s*\{[^}]*grid-template-columns:\s*repeat\(5/s);
});

test('Floating ribbon and side layouts remain scrollable and resizable', () => {
  const layout = read('js/ui/PanelLayoutManager.js');
  const css = read('css/styles.css');
  assert.match(layout, /floatWidth/);
  assert.match(layout, /ResizeObserver/);
  assert.match(css, /#app\.ribbon-float \.ribbon\s*\{[^}]*resize:\s*horizontal/s);
  assert.doesNotMatch(css, /#app\.ribbon-float \.ribbon\s*\{[^}]*min-height/s);
  assert.match(css, /#app\.ribbon-float \.ribbon\s*\{[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.main-area\s*\{[^}]*min-width:\s*0/s);
  assert.match(css, /\.right-sidebar\s*\{[^}]*max-width:\s*min\(42vw/s);
});

test('AI chat exposes safe deterministic actions through one command service', () => {
  const ai = read('js/ai/DeterministicCommandService.js');
  assert.match(html, /id="ai-chat-actions"/);
  assert.match(ai, /export function createDeterministicCommandService/);
  assert.match(ai, /theme-dark/);
  assert.match(ai, /background-checkerboard/);
  assert.match(ai, /flip-horizontal/);
  assert.match(main, /createDeterministicCommandService/);
  assert.match(sidebar, /setAiCommandService/);
});

test('AI provider choice is visible but does not fake external authentication', () => {
  assert.match(html, /id="ai-provider-select"/);
  assert.match(html, /id="ai-connect-button"/);
  assert.match(read('js/ai/AiConnectionStore.js'), /createAiConnectionStore/);
  assert.match(sidebar, /Provider login is planned/);
  assert.match(read('js/settings/SettingsRegistry.js'), /paint:ai-connection/);
});

test('Mirrored preference checkboxes use the event source and persist together', () => {
  assert.match(main, /const onAutoSaveChange = \(event\)/);
  assert.match(main, /const enabled = event\?\.target\?\.checked/);
  assert.match(main, /paint:ai-chat-visibility-change/);
  assert.match(main, /applyAiChatVisibility\(aiCheckbox\?\.checked === true\)/);
});

test('Versioning has one source of truth and a release sync command', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
  assert.match(read('package.json'), /version:sync/);
  assert.match(read('scripts/sync-version.mjs'), /PAINT_VERSION/);
  assert.match(read('js/version.js'), new RegExp(`APP_VERSION = '${packageJson.version}'`));
});

test('Application confirmations use the themed dialog service', () => {
  assert.match(main, /createDialogService/);
  assert.match(read('js/ui/DialogService.js'), /showModal/);
  assert.doesNotMatch(main, /window\.(?:alert|confirm|prompt)\s*\(/);
  assert.doesNotMatch(sidebar, /window\.(?:alert|confirm|prompt)\s*\(/);
  assert.match(html, /id="app-dialog"/);
});

test('Settings includes a feedback path to GitHub issues', () => {
  assert.match(html, /data-settings-tab="feedback"/);
  assert.match(html, /data-settings-panel="feedback"/);
  assert.match(html, /github\.com\/omergal99\/paint\/issues\/new/);
});

test('New defaults are safe and configurable', () => {
  assert.match(read('js/history/GlobalHistory.js'), /DEFAULT_HISTORY_LIMIT = 50/);
  assert.match(html, /id="setting-show-ai-chat"\s*\/>/);
  assert.match(main, /saved\.showAiChat === true/);
  assert.match(html, /id="rotate-selection-toggle" checked/);
  assert.match(main, /mode: s\.historyAutoSaveMode.*lifecycle/);
  assert.match(html, /id="setting-default-canvas-size"/);
  assert.match(html, /id="setting-default-zoom"/);
});

test('Ribbon layout and reusable segmented choices are wired', () => {
  assert.match(main, /new PanelLayoutManager/);
  assert.match(main, /new SegmentedChoice/);
  assert.match(read('js/ui/PanelLayoutManager.js'), /ribbon-(top|left|right|bottom|float)/);
  assert.match(html, /id="ribbon-restore-toggle"/);
  assert.match(main, /paint:pending-history-save/);
  assert.match(read('js/ui/Sidebar.js'), /pointerdown/);
});

test('Text editor alignment scales from one layout object', () => {
  const textTool = read('js/tools/TextTool.js');
  assert.match(textTool, /TEXT_EDITOR_LAYOUT/);
  assert.match(textTool, /topOffsetPercent/);
  assert.match(textTool, /canvasTextOffsetPercent/);
  assert.match(textTool, /lineHeightPercent/);
  assert.match(textTool, /fontSize \* TEXT_EDITOR_LAYOUT\.topOffsetPercent/);
  assert.match(textTool, /export function createTextTool/);
  assert.doesNotMatch(textTool, /class\s+TextTool/);
});

test('Dialogs and palette settings have persistent UX hooks', () => {
  assert.match(main, /setDialogUrl\('settings'/);
  assert.match(main, /restoreDialogFromUrl/);
  assert.match(main, /history-settings-link/);
  assert.match(sidebar, /palette-settings-editor/);
  assert.match(read('js/ui/ColorPalette.js'), /defaultPrimary/);
});

test('Settings reset is centralized and lives with destructive About actions', () => {
  const registry = read('js/settings/SettingsRegistry.js');
  assert.match(html, /data-settings-panel="about"[\s\S]*id="settings-reset"[\s\S]*id="settings-clear-data"/);
  assert.doesNotMatch(html.match(/data-settings-panel="general"[\s\S]*?<\/form>/)?.[0] || '', /id="settings-reset"/);
  assert.match(main, /createSettingsRegistry/);
  assert.match(main, /settingsRegistry\.registerResetHandler/);
  assert.match(main, /Reset all settings to their defaults/);
  assert.match(registry, /paint:colors/);
  assert.match(registry, /paint:panel-layout/);
  assert.match(registry, /registerStorageKey/);
  assert.match(registry, /registerResetHandler/);
  assert.match(read('js/ui/ColorPalette.js'), /resetToDefaults/);
  assert.match(read('js/history/GlobalHistory.js'), /resetSettings/);
});
