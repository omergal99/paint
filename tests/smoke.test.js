import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const html = read('index.html');
const main = read('js/main.js');
const sidebar = read('js/ui/Sidebar.js');
const historyPanel = read('js/ui/HistoryPanel.js');
const settingsDialog = read('js/ui/SettingsDialog.js');
const app = read('js/app.js');
const serviceWorker = read('sw.js');
const responsiveStyle = read('css/progressive.css');
const constants = read('js/core/constants.js');

test('Crop menu owns Remove Background', () => {
  const cropMenuStart = html.indexOf('id="btn-crop-menu"');
  const cropMenuEnd = html.indexOf('</div>', html.indexOf('aria-label="Crop"'));
  const cropMenu = html.slice(cropMenuStart, cropMenuEnd);

  assert.ok(cropMenu.includes('id="btn-crop"'));
	assert.ok(cropMenu.includes('id="btn-remove-bg"'));
	assert.match(cropMenu, /Remove Background/);
	assert.match(cropMenu, /aria-haspopup="dialog"/);
	assert.match(cropMenu, /id="btn-crop"[^>]*disabled/);
  assert.equal((html.match(/id="btn-remove-bg"/g) || []).length, 1);
  assert.ok(!/<button[^>]*class="[^"]*rbtn[^\"]*"[^>]*id="btn-remove-bg"/.test(html));
});
test('Workspace strip has explicit management and split controls', () => {
	assert.doesNotMatch(html, /id="workspace-strip"|class="workspace-strip"/);
	assert.match(main, /const workspaceStripRoot =/);
	assert.match(main, /id = 'workspace-tab-bar'/);
	assert.doesNotMatch(html, /workspace-split-toolbar/);
	assert.match(main, /workspace-split-view/);
	assert.match(html, /id="btn-manage-workspace"/);
	assert.match(html, /id="btn-toggle-split-view"/);
	assert.match(html, /id="workspace-manager-dialog"/);
	assert.match(main, /createTabBar/);
	assert.match(main, /createSplitView/);
});
test('About stats use one shared loading status and resolve their values', () => {
	const aboutStart = html.indexOf('data-settings-panel="about"');
	const aboutEnd = html.indexOf('data-settings-panel="release"');
	const about = html.slice(aboutStart, aboutEnd);
	assert.match(about, /id="about-loading-state"[^>]*data-i18n="ui\.loading"/);
	assert.doesNotMatch(about, /<dd[^>]*>Loading/);
	assert.equal((about.match(/data-i18n="ui\.loading"/g) || []).length, 1);
	assert.match(main, /const loading = document\.getElementById\('about-loading-state'\)/);
	assert.match(main, /finally \{[\s\S]*loading\.hidden = true/);
	assert.match(app, /debugLoading=1&loadingMs=1500/);
	assert.match(app, /RIBBON_STARTUP_MASK_DELAY_MS/);
	assert.match(app, /Math\.min\(10000, Math\.max\(0/);
});
test('Tool menu keeps SVG icons after localization and file icons use the shared line style', () => {
	const toolbar = read('js/ui/Toolbar.js');
	assert.match(toolbar, /data-i18n=\"\$\{i18nKey\}\"/);
	assert.match(toolbar, /removeAttribute\('data-i18n-runtime'\)/);
	assert.match(html, /id="btn-new"[\s\S]*stroke="currentColor"[\s\S]*data-i18n="common\.actions\.new"/);
	assert.match(html, /id="btn-paste"[\s\S]*stroke="currentColor"[\s\S]*data-i18n="common\.actions\.paste"/);
	assert.match(html, /id="btn-open"[\s\S]*data-i18n="ribbon\.file\.openImage"/);
});
test('Clipboard, resize, and fill controls use clear line icons', () => {
	const copy = html.match(/<button[^>]*id="btn-copy"[\s\S]*?<\/button>/)?.[0] || '';
	const resize = html.match(/<button[^>]*id="btn-canvas-size"[\s\S]*?<\/button>/)?.[0] || '';
	const fill = html.match(/<button[^>]*data-tool="fill"[^>]*data-tag="tool-fill"[\s\S]*?<\/button>/)?.[0] || '';
	assert.match(copy, /stroke="currentColor"/);
	assert.match(copy, /<rect[^>]+fill="none"/);
	assert.match(resize, /stroke-linejoin="round"/);
	assert.match(resize, /M14 6V3h3/);
	assert.match(fill, /stroke-linecap="round"/);
	assert.match(fill, /M4 7\.5 8\.5 3/);
});
test('Image action submenus expose consistent icons and translated labels', () => {
	const imageMenuStart = html.indexOf('class="action-menu-items image-more-menu-items"');
	const imageMenuEnd = html.indexOf('<div class="ribbon-group-title">Image</div>');
	const imageMenu = html.slice(imageMenuStart, imageMenuEnd);
	assert.match(imageMenu, /id="btn-crop-menu"[\s\S]*<svg class="icon size4"/);
	assert.match(imageMenu, /id="btn-crop"[\s\S]*data-i18n="ribbon\.image\.cropToSelection"/);
	assert.match(imageMenu, /id="btn-rotate"[\s\S]*<svg class="icon size4"/);
	assert.match(imageMenu, /id="btn-rotate-90"[\s\S]*data-i18n="ui\.rotate90"/);
	assert.match(imageMenu, /id="btn-rotate-free"[\s\S]*data-i18n="ui\.freeRotate"/);
	assert.match(imageMenu, /id="btn-flip"[\s\S]*<svg class="icon size4"/);
	assert.match(imageMenu, /id="btn-flip-horizontal"[\s\S]*data-i18n="ui\.flipHorizontal"/);
	assert.match(imageMenu, /id="btn-flip-vertical"[\s\S]*data-i18n="ui\.flipVertical"/);
	assert.match(read('css/styles.css'), /\.submenu-label\s*\{[\s\S]*gap:\s*5px/);
	assert.match(read('css/styles.css'), /\.submenu-arrow\s*\{[\s\S]*margin-inline-start:\s*auto/);
	assert.match(html, /data-tag="tool-select"[\s\S]*<path\s+d="M3\.5 7V4\.5/);
});
test('Save is owned by File More actions', () => {
	const save = html.match(/<button[^>]*id="btn-save"[\s\S]*?<\/button>/)?.[0] || '';
	assert.match(save, /role="menuitem"/);
	assert.match(save, /<svg class="icon"/);
	assert.doesNotMatch(html.slice(html.indexOf('class="rbtn-stack"'), html.indexOf('id="btn-file-more"')), /id="btn-save"/);
});
test('Background removal is a cancellable preview workflow', () => {
  const controller = read('js/background/BackgroundRemovalController.js');
  assert.match(html, /id="background-removal-dialog"/);
  assert.match(html, /id="background-removal-preview"/);
	assert.match(html, /id="background-removal-progress"/);
	assert.match(html, /id="background-removal-mode"/);
	assert.match(html, /value="soft-edge"/);
	assert.match(html, /id="background-removal-tolerance"/);
	assert.match(html, /id="background-removal-softness"/);
	assert.match(html, /id="background-removal-color"/);
	assert.match(html, /id="background-removal-sample"/);
	assert.match(html, /id="background-removal-preview-button"/);
	assert.match(html, /background-removal-progress-row/);
	assert.match(html, /id="background-removal-keep"/);
	assert.match(html, /id="background-removal-remove"/);
	assert.match(html, /id="background-removal-expand"/);
	assert.match(read('js/background/BackgroundMaskEditor.js'), /setPointerCapture/);
	assert.match(read('js/background/BackgroundMaskEditor.js'), /stopPropagation/);
	assert.match(main, /createBackgroundRemovalService/);
  assert.match(main, /backgroundRemovalController\.open/);
  assert.match(main, /historyManager\.snapshot\(\{ force: true \}\)/);
  assert.match(controller, /controller\?\.signal\.aborted/);
	assert.match(controller, /urlApi\?\.revokeObjectURL/);
	assert.match(main, /target === 'floating'/);
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
  // The dedicated font dropdown was removed - the Shapes size-select is the
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

test('Text editing keeps recent textarea history separate from deferred object editing', () => {
	const textTool = read('js/tools/TextTool.js');
	const historyStore = read('js/document/TextHistoryStore.js');
	assert.match(historyStore, /export const createTextHistoryStore/);
	assert.match(historyStore, /maxTextHistoryEntries/);
	assert.match(textTool, /className = 'text-editor-shell'/);
	assert.match(textTool, /className = 'text-history-select'/);
	assert.match(textTool, /Restore recent text/);
	assert.match(textTool, /textHistoryStore\?\.record/);
	assert.match(textTool, /textHistoryStore\?\.clear/);
	assert.match(main, /textHistoryStore/);
});

test('Settings and text controls expose the refined layout and accessible fields', () => {
	const css = read('css/styles.css');
	const textTool = read('js/tools/TextTool.js');
	assert.match(html, /class="settings-footer settings-footer-nav"/);
	assert.match(html, /class="settings-general-options"/);
	assert.match(html, /class="settings-field ribbon-position-row"/);
	assert.match(css, /dialog h3\s*\{[^}]*margin:\s*0 0 6px/s);
	assert.match(css, /\.settings-footer-nav\s*\{[^}]*grid-column:\s*1/);
	assert.match(css, /\.settings-footer-nav\s*\{[^}]*border-top:\s*1px solid var\(--w10-border\)/s);
	assert.match(css, /\.settings-general-options\s*\{[^}]*grid-template-columns:\s*repeat\(2/s);
	assert.match(css, /\.ribbon-setting-row\s*\{[^}]*display:\s*grid/s);
	assert.match(css, /\.ribbon-settings-list\s*\{[^}]*display:\s*grid/s);
	assert.match(html, /id="btn-text-menu"/);
	assert.match(html, /id="text-select-after-draw"/);
	assert.doesNotMatch(html, /id="text-select-after-draw"[^>]*disabled/);
	assert.match(html, /id="primary-alpha"/);
	assert.match(html, /id="secondary-alpha"/);
	assert.match(read('js/ui/ColorPalette.js'), /color-palette-context-menu|Palette color actions/);
	assert.match(read('js/tools/FreehandTools.js'), /globalAlpha/);
	assert.match(read('js/tools/FillTool.js'), /secondaryAlpha|primaryAlpha/);
	assert.match(read('js/tools/ShapeTool.js'), /outlineAlpha|fillAlpha/);
	assert.match(read('js/tools/TextTool.js'), /primaryAlpha/);
	assert.match(textTool, /nextEditor\.id = 'text-editor-input'/);
	assert.match(textTool, /nextEditor\.name = 'text'/);
	assert.match(textTool, /shell\.append\(nextEditor, toolbar\)/);
	assert.match(textTool, /toolbar\.addEventListener\('pointerdown'/);
	assert.match(read('js/ui/Toolbar.js'), /paint:text-history-toolbar-change/);
	assert.match(read('js/ui/Toolbar.js'), /_applyRememberedStyle\(\{ restoreColor: true \}\)/);
	assert.match(read('js/ui/Toolbar.js'), /Foregound color\/alpha are global picker state|Foreground color\/alpha are global picker state/);
	assert.match(read('js/ui/TextSelectionOverlay.js'), /text-object-focus-layer/);
	assert.match(textTool, /getTextSelectAfterDraw/);
	assert.match(textTool, /if \(text\.trim\(\)\.length === 0\) return false/);
	assert.match(textTool, /const committed = commit\(\);[\s\S]*if \(committed && ctx\.getTextSelectAfterDraw/);
	assert.match(main, /selectTextObject/);
});

test('Standalone named functions use arrow constants', () => {
	const files = [];
	const collect = (dir) => {
		for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
			const relative = path.join(dir, entry.name);
			if (entry.isDirectory()) collect(relative);
			else if (entry.name.endsWith('.js')) files.push(relative);
		}
	};
	['js', 'tests', 'scripts'].forEach(collect);
	files.forEach((file) => {
		assert.doesNotMatch(read(file), /^\s*(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$]/m, file);
	});
});

test('Keyboard paste defers to the native paste event for macOS support', () => {
  assert.match(read('js/main.js'), /document\.addEventListener\('paste'/);
  const shortcutBlock = main.match(/window\.addEventListener\('keydown'[\s\S]*?\n\}\);\n/)?.[0] || '';
  assert.ok(!/case 'v':[\s\S]*clipboardManager\.paste\(\)/.test(shortcutBlock),
    'Cmd+V must not route through navigator.clipboard.read()');
  assert.match(read('js/clipboard/ClipboardManager.js'), /_pngBlobFromCanvas/,
    'Copy must encode the PNG synchronously to keep the Safari user gesture alive');
});

test('keyboard shortcuts are SSOT-backed, editable in Settings, and persisted', () => {
  assert.match(html, /data-settings-tab="shortcuts"\s*>\s*SHORTCUTS/);
  assert.match(html, /data-settings-panel="shortcuts"/);
  assert.match(html, /id="shortcut-settings-list"/);
  assert.match(read('js/core/constants.js'), /SHORTCUT_DEFINITIONS/);
  assert.match(read('js/settings/ShortcutManager.js'), /normalizeShortcut/);
  assert.match(main, /createShortcutManager/);
  assert.match(main, /settingsStore\.set\(\{ shortcuts: shortcutManager\.get\(\) \}\)/);
  assert.match(main, /shortcutManager\.resolve\(shortcut\)/);
});

test('the first paint matches the default visual settings', () => {
  assert.match(html, /id="btn-ai-chat"[^>]*style="display: none;"/);
  assert.match(html, /id="primary-swatch"[^>]*background-color: #a349a4/);
  assert.match(html, /id="secondary-swatch"[^>]*background-color: #ffffff/);
	assert.match(html, /id="ci-hex"[^>]*>#a349a4</);
	assert.match(html, /id="ci-rgb"[^>]*>rgb\(163, 73, 164\)</);
	assert.equal((html.match(/data-bootstrap-palette/g) || []).length, 28);
	assert.match(main, /applyAiChatVisibility\(aiCheckbox\?\.checked === true\)/);
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

	test('startup image restore is opt-in and settings search is modular', () => {
	assert.match(html, /id="setting-restore-last-image"/);
	assert.match(html, /id="settings-search-input"/);
	assert.match(html, /id="settings-search-status"/);
	assert.match(main, /shouldRestoreLastImage/);
	const app = read('js/app.js');
	assert.match(app, /shouldRestoreLastImage/);
	assert.doesNotMatch(app, /canRestoreLastImage/, 'startup must not destructure into an undeclared alias');
	assert.match(read('js/ui/DialogSearch.js'), /createDialogSearch/);
	assert.match(read('js/ui/DialogSearch.js'), /previousButton/);
	assert.doesNotMatch(read('js/ui/DialogSearch.js'), /press Enter to go/);
	assert.match(main, /createDialogSearch/);
	assert.match(sidebar, /snapshot\?\.\(\{ force: true \}\)/);
	assert.match(sidebar, /waitForPendingSnapshots/);
	const makefile = read('Makefile');
	assert.match(makefile, /^setup:/m);
	assert.match(makefile, /^dev:/m);
});

test('localization registry, complete catalogs, and settings selector are wired', () => {
  assert.match(html, /id="setting-locale"/);
	assert.match(html, /id="settings-search-prev"/);
	assert.match(html, /id="settings-search-next"/);
	assert.match(html, /id="settings-search-prev"[^>]*hidden/);
  assert.match(main, /createLocaleController/);
  assert.match(read('js/i18n/localeRegistry.js'), /SUPPORTED_LOCALES/);
  assert.match(read('js/i18n/LocaleController.js'), /paint:locale-change/);
  assert.match(read('js/i18n/README.md'), /Adding a language|Add the normalized/);
  assert.match(read('js/i18n/catalogs/es.js'), /ES_MESSAGES/);
  assert.match(read('js/i18n/uiText.js'), /UI_TEXT_KEYS/);
  assert.match(read('package.json'), /check:i18n/);
  assert.match(read('sw.js'), /\.\/js\/i18n\/localeRegistry\.js/);
  assert.match(read('sw.js'), /\.\/js\/i18n\/catalogs\/es\.js/);
  assert.match(read('sw.js'), /\.\/js\/i18n\/LocaleController\.js/);
  assert.match(read('sw.js'), /\.\/js\/i18n\/uiText\.js/);
});

test('language setting keeps its label and selector on one compact row', () => {
  assert.match(html, /settings-field choice-field inline-choice-field/);
  assert.doesNotMatch(html, /setting-locale-help/);
  assert.match(read('css/styles.css'), /\.inline-choice-field\s*\{[\s\S]*flex-direction:\s*row/);
});

test('direction preference and RTL layout mirroring are available independently', () => {
  assert.match(html, /id="setting-direction"/);
  assert.match(read('js/main.js'), /interfaceDirection/);
  assert.match(read('js/i18n/LocaleController.js'), /setDirection/);
  assert.match(read('css/styles.css'), /html\[dir="rtl"\] \.handle-corner/);
  assert.match(read('css/styles.css'), /border-inline-end/);
});

test('history settings checkboxes have a clear vertical gap', () => {
  assert.match(read('css/styles.css'), /\.history-checkbox-row\s*\{[\s\S]*margin-bottom: 8px/);
});

test('checkbox rows keep empty whitespace inert and expose explicit hit targets', () => {
  assert.doesNotMatch(html, /<label class="checkbox-row"/);
  assert.doesNotMatch(html, /<label class="menu-checkbox/);
  assert.doesNotMatch(html, /<div class="checkbox-row(?:\s[^"]*)?"(?![^>]*data-tag)/);
  assert.match(html, /class="checkbox-row history-checkbox-row" data-tag="setting-history-auto-save-row"/);
  assert.match(read('css/styles.css'), /\.history-checkbox-row\s*\{[\s\S]*margin-bottom: 8px/);
  assert.doesNotMatch(read('css/styles.css'), /settings-panel\[data-settings-panel="history"\] > \.checkbox-row/);
  assert.match(read('css/styles.css'), /\.checkbox-row input:not\(:disabled\),[\s\S]*\.checkbox-row > label/);
  assert.match(read('css/styles.css'), /\.menu-checkbox input,[\s\S]*\.menu-checkbox > label/);
  assert.match(read('js/ui/Sidebar.js'), /htmlFor = cbGroup\.id/);
  assert.match(main, /checkboxLabel\.htmlFor = checkbox\.id/);
  assert.match(read('js/ui/Sidebar.js'), /toggleGroup\.dataset\.tag/);
  assert.match(main, /label\.dataset\.tag = `ribbon-group-visibility-row/);
  assert.match(main, /if \(!element\.dataset\.tag\) element\.dataset\.tag = element\.id/);
});

test('settings search keeps text intact and reports only deepest areas', () => {
  const search = read('js/ui/DialogSearch.js');
  assert.match(search, /query\.length < 2/);
  assert.match(search, /addDeepestOwner/);
  assert.doesNotMatch(search, /createTreeWalker|markText|unwrapMarks/);
  assert.match(read('css/styles.css'), /\.dialog-search-tab-match::after/);
  assert.match(read('css/styles.css'), /padding-inline: 10px 6px/);
  assert.match(read('css/styles.css'), /\.settings-search\s*\{[\s\S]*margin-bottom: 0px/);
  assert.match(read('js/ui/SettingsDialog.js'), /focusTarget\?\.focus/);
  assert.match(read('css/styles.css'), /html\[dir="rtl"\] \.canvas-viewport,[\s\S]*direction: rtl/);
  assert.match(read('css/styles.css'), /html\[dir="rtl"\] \.canvas-scale\s*\{[\s\S]*transform-origin: top right/);
  assert.match(read('css/styles.css'), /html\[dir="rtl"\] \.handle-right\s*\{[\s\S]*right: auto[\s\S]*left: -4px/);
  assert.match(read('css/styles.css'), /html\[dir="rtl"\] \.handle-corner\s*\{[\s\S]*right: auto[\s\S]*left: -14px[\s\S]*transform-origin: top right/);
  assert.match(read('css/styles.css'), /html\[dir="rtl"\] \.resize-ghost\s*\{[\s\S]*right: 0[\s\S]*left: auto/);
  assert.match(main, /refreshCanvasDirectionGeometry/);
  assert.match(main, /viewportManager\.invalidateGeometry\(\);[\s\S]*canvasResizer\.reposition\(\)/);
  assert.match(read('js/canvas/ViewportManager.js'), /alignRtlResizeEdge/);
  assert.match(read('js/canvas/ViewportManager.js'), /scrollLeft = -maxScroll/);
  assert.match(main, /directionEventTarget\.addEventListener\('paint:locale-change', refreshCanvasDirectionGeometry\)/);
  assert.match(main, /directionEventTarget\.removeEventListener\('paint:locale-change', refreshCanvasDirectionGeometry\)/);
  assert.match(read('index.html'), /data-i18n="ribbon\.annotations\.more">More<\/span>/);
  assert.match(read('js/i18n/messages.js'), /more: 'More'/);
  assert.match(read('index.html'), /class="ribbon ribbon-loading"/);
  assert.match(read('js/app.js'), /RIBBON_STARTUP_MASK_ENABLED = true/);
  assert.match(read('js/app.js'), /paint:ready.*releaseRibbonStartupMask/s);
  assert.match(read('index.html'), /class="ribbon-group ribbon-group-file" data-ribbon-key="file"/);
  assert.match(main, /getRibbonGroupKey/);
  assert.match(main, /ribbonVisibility\[stableKey\] \?\? ribbonVisibility\[legacyKey\]/);
  assert.doesNotMatch(main, /ribbonVisibility\[title\.textContent\.trim\(\)\]/);
  assert.match(read('css/styles.css'), /--w10-search-accent/);
  assert.match(read('css/styles.css'), /body\.dark-mode[\s\S]*--w10-search-accent/);
  assert.match(read('css/styles.css'), /\.settings-tab\.dialog-search-tab-active\s*\{[\s\S]*box-shadow: inset 0 0 0 2px var\(--w10-search-accent\)/);
  assert.match(search, /firstResultIndex = results\.findIndex/);
  assert.match(read('css/styles.css'), /right: 2px[\s\S]*bottom: 2px[\s\S]*min-width: 10px[\s\S]*padding: 0 1px[\s\S]*font-size: 10px[\s\S]*line-height: 12px/);
  assert.match(main, /if \(editable\) return;[\s\S]*selectAll\(\)/);
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
  assert.match(vpm, /if \(!event\.ctrlKey && !event\.metaKey\) return/);
  // Zoom still works both directions for Ctrl+wheel…
  assert.match(vpm, /this\.zoom \+ \(event\.deltaY < 0 \? STEP : -STEP\)/);
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
  assert.match(serviceWorker, /GlobalHistory\.js/);
});

test('PWA settings expose install/update controls and versioned update flow', () => {
	const pwa = read('js/pwa/PwaInstallManager.js');
	const syncVersion = read('scripts/sync-version.mjs');
	const appBootstrap = read('js/app.js');
	assert.match(html, /data-settings-tab="app"/);
	assert.match(html, /id="pwa-install-button"/);
	assert.match(html, /id="pwa-update-button"/);
	assert.match(html, /id="pwa-offline-button"/);
	assert.match(html, /id="pwa-install-status"[^>]*hidden/);
	assert.match(html, /id="pwa-offline-status"[^>]*hidden/);
	assert.match(pwa, /beforeinstallprompt/);
	assert.match(pwa, /controllerchange/);
	assert.match(pwa, /registration\.update/);
	assert.match(pwa, /canReload/);
	assert.match(pwa, /Finish the current edit/);
	assert.match(pwa, /prepareOffline/);
	assert.match(pwa, /MessageChannel/);
	assert.match(pwa, /translate\('ui\.offlineUse', 'Offline use'\)/);
	assert.match(pwa, /statusEl\.hidden = false/);
	assert.match(serviceWorker, /CACHE_ALL/);
	assert.match(serviceWorker, /cache\.match\(asset\)/);
	assert.match(syncVersion, /CACHE_NAME/);
	assert.match(serviceWorker, /SKIP_WAITING/);
	assert.match(appBootstrap, /sw\.js\?version=/);
});

test('Hand/Pan is available as a shared tool and shortcut', () => {
	const pan = read('js/tools/PanTool.js');
	assert.match(html, /data-tool="pan"/);
	assert.match(main, /createPanTool/);
	assert.match(main, /SHORTCUT_ACTIONS\.panTool\]:\s*'pan'/);
	assert.match(pan, /scrollLeft/);
	assert.match(pan, /scrollTop/);
	assert.match(read('css/styles.css'), /#canvas-viewport\.pan-mode/);
});

test('Mobile status bar stays on one line and hides app branding', () => {
  assert.match(responsiveStyle, /\.status-bar\s*\{[^}]*white-space:\s*nowrap/s);
  assert.match(responsiveStyle, /\.status-item\.app-name\s*\{\s*display:\s*none/s);
  assert.match(responsiveStyle, /\.status-bar\s*\{[^}]*overflow-x:\s*auto/s);
});

test('Action menus choose their direction from available viewport space', () => {
  const actionMenus = read('js/ui/ActionMenuController.js');
  const css = read('css/styles.css');
  assert.match(actionMenus, /const measureMenu = \(menuItems\)/);
  assert.match(actionMenus, /const clamp = \(value, min, max\)/);
  assert.match(actionMenus, /placement === 'submenu'/);
  assert.match(actionMenus, /menuItems\.style\.right/);
  assert.match(actionMenus, /const isRtl = \(\) =>/);
  assert.match(actionMenus, /const openSubmenuKey = isRtl\(\) \? KEYBOARD_KEYS\.arrowLeft/);
  assert.match(actionMenus, /const closeSubmenuKey = isRtl\(\) \? KEYBOARD_KEYS\.arrowRight/);
  assert.match(actionMenus, /menuItems\.dataset\.direction = direction/);
  assert.match(css, /\.action-menu-items\s*\{[^}]*inset-inline-start:\s*0/s);
  assert.match(css, /\.action-menu-items button\s*\{[^}]*text-align:\s*start/s);
  assert.match(css, /html\[dir="rtl"\] \.submenu-arrow/);
  assert.match(main, /createActionMenuController/);
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
	assert.match(ai, /export const createDeterministicCommandService/);
  assert.match(ai, /theme-dark/);
  assert.match(ai, /background-checkerboard/);
  assert.match(ai, /flip-horizontal/);
  assert.match(main, /createDeterministicCommandService/);
  assert.match(sidebar, /setAiCommandService/);
});

test('AI provider launcher never collects API keys', () => {
  assert.match(html, /id="ai-provider-select"/);
  assert.match(html, /id="ai-connect-button"/);
  assert.match(html, /id="ai-connection-dialog"/);
  assert.match(html, /id="ai-provider-link"/);
  assert.doesNotMatch(html, /id="ai-api-key"/);
  assert.match(read('js/ai/AiConnectionStore.js'), /createAiConnectionStore/);
  assert.match(sidebar, /_openAiConnectionDialog/);
  assert.match(sidebar, /_copyCurrentImageForAi/);
  assert.doesNotMatch(read('js/ai/AiConnectionStore.js'), /setApiKey|clearApiKey/);
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
  assert.match(html, /id="setting-show-ai-chat"[^>]*\/>/);
  assert.match(main, /saved\.showAiChat === true/);
  assert.match(html, /id="rotate-selection-toggle" checked/);
  assert.match(main, /mode: s\.historyAutoSaveMode.*lifecycle/);
  assert.match(html, /id="setting-default-canvas-size"/);
  assert.match(html, /id="setting-default-zoom"/);
});

test('Ribbon layout and reusable segmented choices are wired', () => {
  assert.match(main, /new PanelLayoutManager/);
  assert.match(main, /createSegmentedChoice/);
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
	assert.match(textTool, /export const createTextTool/);
  assert.doesNotMatch(textTool, /class\s+TextTool/);
});

test('Dialogs and palette settings have persistent UX hooks', () => {
  assert.match(main, /setDialogUrl\('settings'/);
	assert.match(main, /restoreDialogFromUrl/);
	assert.match(main, /params\.delete\('tab'\)/);
	assert.match(main, /localStorage\.setItem\(STORAGE_KEYS\.settingsTab/);
	assert.match(main, /getLastSettingsTab/);
	assert.match(constants, /settingsTab:/);
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

test('Community standards files and contributor templates are discoverable', () => {
  for (const file of [
    'CONTRIBUTING.md',
    'docs/CODE_OF_CONDUCT.md',
    'SECURITY.md',
    '.github/pull_request_template.md',
    '.github/ISSUE_TEMPLATE/bug_report.md',
    '.github/ISSUE_TEMPLATE/feature_request.md',
    'docs/work1/COMMUNITY_STANDARDS.md',
    '.skills/community-standards-audit/SKILL.md',
  ]) {
    assert.ok(fs.existsSync(path.join(root, file)), `Missing community file: ${file}`);
  }
  assert.match(read('README.md'), /CONTRIBUTING\.md/);
  assert.match(read('README.md'), /SECURITY\.md/);
  assert.match(read('docs/work1/COMMUNITY_STANDARDS.md'), /Needs owner decision/);
});

test('P0 quick wins: hover affordance, slider, release notes, fresh paste, undo keys', () => {
  const css = read('css/styles.css');
  const toolbar = read('js/ui/Toolbar.js');
  // #5 hover affordance for inactive tool-status button
  assert.match(css, /\.tool-status-btn\.inactive-status:hover/);
  assert.match(css, /cursor:\s*pointer/);
  // #3 reusable slider component mounted above size boxes
  assert.ok(fs.existsSync(path.join(root, 'js/ui/SliderControl.js')), 'SliderControl.js missing');
  assert.match(html, /id="size-slider-row"/);
  assert.match(toolbar, /createSliderControl/);
  assert.match(toolbar, /Font size slider/);
  // SW precaches new modules so offline stays intact
  assert.match(read('sw.js'), /SliderControl\.js/);
  assert.match(read('sw.js'), /releaseNotes\.js/);
  assert.match(read('sw.js'), /EmojiStore\.js/);
  // #4 release notes tab + deep link support
  assert.match(html, /data-settings-tab="release"/);
  assert.match(html, /data-settings-panel="release"/);
  assert.match(html, /id="release-notes-list"/);
  assert.ok(fs.existsSync(path.join(root, 'js/releaseNotes.js')), 'releaseNotes.js missing');
  assert.match(main, /renderReleaseNotes/);
  // #2 clean-doc first paste at 0,0
  assert.match(read('js/clipboard/ClipboardManager.js'), /isCleanDocument/);
  assert.match(read('js/canvas/CanvasManager.js'), /isCleanDocument\(\)/);
  // #1 select-after-draw toggle (default OFF) + V anchored to drag box
  assert.match(html, /id="shape-select-after-draw"/);
  assert.match(toolbar, /paint:shape-select-after-draw/);
  assert.match(read('js/tools/ShapeTool.js'), /getSelectAfterDraw/);
  // #6/#8 history tabs + thumbs + quota + undo shortcuts
  assert.match(html, /data-history-view="session"/);
  assert.match(css, /\.history-view-tab/);
  assert.match(css, /#history-save-current-btn/);
  assert.match(read('js/history/GlobalHistory.js'), /makeThumbnail/);
  assert.match(html, /id="about-storage-free"/);
	assert.match(read('js/core/constants.js'), /mod\+shift\+z/);
});

test('Round-2 fixes: V glyph, session persistence, view-aware actions, storage math', () => {
  const css = read('css/styles.css');
  const history = read('js/history/HistoryManager.js');
  const sidebar = read('js/ui/Sidebar.js');
  // 1. V icon + glyph: user check-mark path, re-authored centred on the
  //    20-grid, and drawn with ONE scale factor so the arms keep their angle
  const shapeToolSrc = read('js/tools/ShapeTool.js');
  assert.match(html, /data-shape="v"[\s\S]*?viewBox="0 0 20 20"[\s\S]*?d="M 3 10\.5 L 8 15\.5 L 17 4\.5"/);
  assert.match(shapeToolSrc, /Check-mark "V"/);
  assert.match(shapeToolSrc, /const V_MARK = \{/);
  // glyph bbox centre == viewBox centre (10,10) so the tile is dead-centre
  assert.match(shapeToolSrc, /minX: 3,[\s\S]*?maxX: 17,[\s\S]*?minY: 4\.5,[\s\S]*?maxY: 15\.5/);
  // uniform scale => constant arm angles regardless of drag aspect
  assert.match(shapeToolSrc, /const k = box\.size \/ Math\.max\(spanX, spanY\)/);
  assert.ok(!/w \* 0\.12/.test(shapeToolSrc), 'V glyph must not stretch x/y independently');
  // Emoji shape: gallery tile + picker + canvas render + shift-ratio resize
  assert.match(html, /data-shape="emoji"/);
  assert.match(html, /id="shape-emoji-grid"/);
  assert.match(read('js/tools/EmojiStore.js'), /EMOJI_CATALOG/);
  assert.match(read('js/tools/ShapeTool.js'), /case 'emoji'/);
  assert.match(read('js/ui/Toolbar.js'), /getSelectedEmoji/);
  assert.match(main, /hold Shift to keep the aspect ratio/);
  assert.match(read('css/styles.css'), /\.shape-emoji-grid/);
  // 2. Session survives refresh, dies with browser tab (sessionStorage)
  assert.match(history, /SESSION_BACKUP_KEY/);
  assert.match(history, /sessionStorage/);
  assert.match(history, /clearSession/);
    // 2.1 action label mirrors the active tab + view-aware button wording
  assert.match(html, /id=\"history-actions-label\"/);
  assert.match(html, /Save Current/);
  assert.match(html, /Export All/);
  assert.match(html, /Clear All/);
  assert.match(sidebar, /_syncHistoryActionLabels/);
  assert.match(historyPanel, /history-actions-label/);
  assert.match(main, /exportSessionEntry/);
	assert.match(main, /sidebar\.historyView === HISTORY_VIEWS\.session/);
  // 3. taller settings dialog + compact ribbon rows
  assert.match(css, /height:\s*min\(470px,\s*88vh\)/);
  assert.match(css, /\.ribbon-setting-row:hover/);
	// 3.2 storage math: validated raw bytes, fresh browser estimate, exact free
	//     space, and a bounded percentage bar.
	assert.doesNotMatch(main, /STORAGE_ESTIMATE_CACHE_TTL_MS/);
	assert.match(main, /normalizeStorageEstimate/);
	assert.match(main, /getStorageEstimate/);
	assert.match(main, /minimumFractionDigits: 2/);
	assert.match(main, /GiB/);
	assert.match(main, /free of/);
	assert.match(main, /browser estimate/);
	assert.match(main, /Math\.min\(100, Math\.max\(1, Math\.ceil/);
});

test('Round-2 stabilization: alpha, text commit, and nested image actions', () => {
	const css = read('css/styles.css');
	const textTool = read('js/tools/TextTool.js');
	const canvas = read('js/canvas/CanvasManager.js');
	const actionMenu = read('js/ui/ActionMenuController.js');
	const controller = read('js/ui/ActionMenuController.js');
	assert.match(css, /\.swatch-stack\s*\{[^}]*width:\s*32px[^}]*height:\s*32px/s);
	assert.match(css, /\.swatch-alpha-trigger\s*\{[^}]*flex-direction:\s*row/s);
	assert.match(css, /\.swatch-alpha-trigger\s*\{[^}]*width:\s*30px[^}]*height:\s*16px/s);
	assert.doesNotMatch(html, /swatch-alpha-transparent/);
	assert.doesNotMatch(css, /swatch-alpha-transparent/);
	assert.match(html, /id="btn-image-more"/);
	assert.match(html, /class="action-menu-trigger action-submenu-trigger"[^>]*id="btn-crop-menu"/);
	assert.match(html, /class="action-menu-trigger action-submenu-trigger"[^>]*id="btn-rotate"/);
	assert.match(html, /class="action-menu-trigger action-submenu-trigger"[^>]*id="btn-flip"/);
	assert.match(actionMenu, /root\.addEventListener\('click', handleRootClick\)/);
	assert.match(actionMenu, /root\.removeEventListener\('click', handleRootClick\)/);
	assert.match(main, /const commitFloatingPixels = \(region\) =>/);
	assert.match(canvas, /export const commitLayerWithSourceOver = \(context, layer, region\) =>/);
	assert.match(canvas, /globalAlpha = 1;[\s\S]*globalCompositeOperation = 'source-over'/);
	assert.match(main, /commitLayerWithSourceOver\(canvasManager\.ctx/);
	assert.match(textTool, /commit\(\);[\s\S]*getTextSelectAfterDraw\?\.\(\) === true/);
	assert.match(css, /\.text-editor-toolbar\.is-empty\s*\{/);
	assert.match(textTool, /toolbar\.hidden = false/);
	assert.match(textTool, /toolbar\.setAttribute\('aria-hidden', String\(!historyVisible\)\)/);
	assert.match(textTool, /control\.hidden = !historyVisible/);
	assert.match(controller, /const ancestorsOf = \(menu\) =>/);
	assert.match(controller, /const handleKeyboard = \(event\) =>/);
	assert.match(controller, /event\.key === KEYBOARD_KEYS\.arrowLeft/);
	assert.match(controller, /submenuTrigger\?\.focus\(\)/);
	assert.match(controller, /paint:action-menu-open-at/);
	assert.match(read('js/ui/ColorPalette.js'), /paint:action-menu-open-at/);
	assert.match(main, /const nudgeSelection = \(dx, dy\) =>/);
	assert.match(main, /if \(e\.defaultPrevented\) return/);
	assert.match(historyPanel, /export const createHistoryPanel/);
	assert.match(sidebar, /createHistoryPanel/);
	assert.match(settingsDialog, /export const createSettingsDialog/);
	assert.match(main, /createSettingsDialog/);
});

test('Phase 2 Steps 02–04 contracts and UX hooks are wired', () => {
  const history = read('js/history/HistoryManager.js');
  const canvas = read('js/canvas/CanvasManager.js');
  assert.ok(fs.existsSync(path.join(root, 'js/core/constants.js')));
  assert.ok(fs.existsSync(path.join(root, 'js/core/EventBus.js')));
  assert.ok(fs.existsSync(path.join(root, 'js/settings/SettingsStore.js')));
  assert.match(main, /createSettingsStore/);
  assert.match(history, /getSessionEntries()/);
  assert.match(history, /removeSessionEntry\(id\)/);
  assert.match(sidebar, /historyManager\.restore\(entry\)/);
  assert.match(sidebar, /historyManager\.removeSessionEntry\(entry\.id\)/);
  assert.match(html, /id="resize-percent"/);
  assert.match(html, /id="resize-keep-aspect"[^>]*checked/);
  assert.match(main, /activeResizeTarget()/);
  assert.match(main, /scaleCanvas\(source, w, h\)/);
  assert.match(canvas, /backgroundMode/);
  assert.match(canvas, /clearRect\(x, y, width, height\)/);
  assert.match(html, /option value="transparent"/);
  assert.doesNotMatch(html, /id="settings-cancel"/);
  assert.doesNotMatch(html, /id="settings-about-close"/);
});

test('select after draw: a lifted shape is a layer, and unload bakes it', () => {
  const main = read('js/main.js');
  const shapeTool = read('js/tools/ShapeTool.js');
  const canvas = read('js/canvas/CanvasManager.js');
  // The shape is measured on a transparent scratch canvas so the layer carries
  // the ink only - never a copy of the background or of the artwork underneath.
  assert.match(canvas, /renderShapeLayer\(bounds, drawFn, pad = 0\)/);
  assert.match(canvas, /_alphaBounds\(/);
  assert.match(canvas, /const scratch = document\.createElement\('canvas'\)/);
  // Ink bounds (not the drag box) set the selection, with a re-measure when the
  // measured ink touches the scratch edge and was therefore cut off.
  assert.match(canvas, /if \(!out\.clipped \|\| out\.area > MAX_MEASURE_PIXELS\) return out\.result/);
  assert.match(canvas, /const MAX_MEASURE_PIXELS = 16 \* 1024 \* 1024/);
  assert.match(shapeTool, /cm\.floatingCanvas = lifted\.layer/);
  assert.match(shapeTool, /ctx\.setSelection\(\{ x: lifted\.x, y: lifted\.y, w: lifted\.w, h: lifted\.h \}\)/);
  // The canvas is untouched until the selection is left, so force the undo entry.
  assert.match(shapeTool, /snapshot\?\.\(\{ force: true \}\)/);
  // Closing or refreshing counts as leaving the selection: bake before saving,
  // otherwise the just-drawn shape would be silently discarded.
  assert.match(main, /beforeunload'[\s\S]{0,400}?commitFloatingSelection\(\)/);
  assert.match(main, /pagehide'[\s\S]{0,200}?commitFloatingSelection\(\)/);
  // Moving a lifted layer must not lift + erase again (that erased artwork under
  // the shape). SelectTool only lifts when nothing is floating yet.
  assert.match(read('js/tools/SelectTool.js'), /if \(!ctx\.canvasManager\.floatingCanvas\) \{[\s\S]*?fillRegion\(sel, ctx\.canvasManager\.backgroundColor\)/);
  // The click that places the shape is mid-gesture: the tool restore must be
  // deferred to that gesture's pointerup (ToolManager), never applied during
  // onDown - an immediate switch leaves SelectTool a stale drag start + 0x0
  // marquee, so the next mouse move ghost-draws a phantom selection.
  const toolManager = read('js/tools/ToolManager.js');
  assert.match(main, /if \(toolManager\._dragging\) toolContext\._pendingToolRestore = target/);
  assert.match(main, /else toolManager\.setActive\(target\)/);
  assert.match(toolManager, /const pending = this\.toolContext\?\._pendingToolRestore/);
  assert.match(toolManager, /this\._flushQueuedMove\(event\.pointerId\)/);
  assert.match(toolManager, /if \(cancelled\) this\.active\?\.onCancel\?\./);
  // Both tools drop stale gesture state when activated, so a mid-gesture
  // switch can never leak a phantom drag into the new tool.
	assert.match(read('js/tools/SelectTool.js'), /const onActivate = \(ctx\) => \{[\s\S]*?state\.start = null;/);
	assert.match(shapeTool, /const onActivate = \(\) => \{[\s\S]*?state\.start = null;/);
});

test('selection-handle drags are explicitly released with the editor', () => {
	const destroyEditorBlock = main.match(/const destroyEditor = \(\) => \{[\s\S]*?\n\};/)?.[0] || '';
	assert.match(main, /const bindSelectionHandles = \(\) => \{[\s\S]*?handle\.removeEventListener\('pointerdown', onPointerDown\)[\s\S]*?stopSelectionHandleDrag\(\)/);
	assert.match(main, /const destroySelectionHandleBindings = bindSelectionHandles\(\);/);
	assert.match(main, /const bindRotateSelectionHandle = \(\) => \{[\s\S]*?stopSelectionRotationDrag\(\)[\s\S]*?rotateSelectionHandle\.removeEventListener\('pointerdown', onPointerDown\)/);
	assert.match(main, /window\.addEventListener\('pointercancel', onCancel, \{ once: true \}\);/);
	assert.match(destroyEditorBlock, /destroySelectionHandleBindings\(\);/);
	assert.match(destroyEditorBlock, /destroyRotateSelectionHandleBinding\(\);/);
});

test('text focus owns a separate layer instead of the pixel-selection path', () => {
  const textTool = read('js/tools/TextTool.js');
  const layerService = read('js/document/TextLayerService.js');
  const overlay = read('js/ui/TextSelectionOverlay.js');
  const canvas = read('js/canvas/CanvasManager.js');
  assert.ok(fs.existsSync(path.join(root, 'js/document/TextLayerRenderer.js')));
  assert.match(main, /createTextLayerService/);
  assert.match(main, /setLayerComposer/);
  assert.match(html, /id="text-layer-canvas"/);
  assert.match(layerService, /createTextLayerService/);
  assert.match(layerService, /store\.update\(id/);
  assert.match(overlay, /onMoveStart/);
  assert.match(overlay, /ArrowLeft/);
  assert.match(textTool, /textLayerService/);
  assert.doesNotMatch(textTool, /canvasContext\.fillText/);
  assert.match(canvas, /flattenLayers()/);
  assert.match(canvas, /toDataURL\(type = 'image\/png'/);
});
