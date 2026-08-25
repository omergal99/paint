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
const responsiveStyle = read('style.css');

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
  assert.match(read('style.css'), /#file-input\s*\{[^}]*display:\s*none\s*!important/s);
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

