// js/app/settingsHydration.js
// Applies the persisted settings to the UI at startup: control values, canvas
// background mode, default zoom/canvas size, ribbon layout and the segmented
// choice summaries. Phase 3 modularisation.
import { renderSegmentedChoices } from '../ui/segmentedChoices.js';
import { appState } from './appState.js';
import { DEFAULT_SETTINGS } from '../core/constants.js';

const byId = (id) => document.getElementById(id);

/**
 * Resolved default zoom from the Settings selects.
 *
 * Exported (not created per `initSettingsHydration` call) because `main.js`
 * closes over it from `saveSettings`, which is wired up far earlier in the
 * composition root. As a module binding it is always initialised, so the save
 * path can never hit a temporal dead zone.
 */
export const getDefaultZoom = () => {
  const raw = byId('setting-default-zoom')?.value === 'custom'
    ? byId('setting-default-zoom-custom')?.value
    : byId('setting-default-zoom')?.value;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(800, Math.max(10, Math.round(value))) : 100;
};

/**
 * @param {object} deps collaborators owned by main.js
 */
export const initSettingsHydration = ({
  canvasManager,
  viewportManager,
  readSettings,
  getRibbonGroupKey,
  localeController,
  applyAiChatVisibility,
  ribbonLayoutManager,
  settingsShowRibbon,
  syncRibbonLayoutControls,
  renderShortcutSettings,
  syncHistoryControls,
  syncHistoryLimitSelect,
  syncRibbonSettingsControls,
  getDefaultCanvasSize,
}) => {
  const applyCanvasBackgroundMode = (mode) => {
    const value = mode || 'none';
    // Transparent and Transparent Checkerboard are the same pixel mode: both
    // mean "no opaque background", so fills and New must clear instead of
    // painting a solid color behind them.
    const transparent = value === 'transparent' || value === 'checkerboard';
    canvasManager.setBackgroundMode(transparent ? 'transparent' : 'solid');
    const solidColorControl = document.querySelector('[data-solid-color-control]');
    if (solidColorControl) solidColorControl.hidden = !['none', 'solid'].includes(value);
    const viewport = document.getElementById('canvas-viewport');
    viewport.classList.remove('bg-checkerboard', 'bg-grid', 'bg-transparent');
    if (value === 'transparent') viewport.classList.add('bg-transparent');
    else if (value === 'checkerboard') viewport.classList.add('bg-checkerboard');
    else if (value === 'grid') viewport.classList.add('bg-grid');
  };

  const syncDefaultCanvasInputsFromSelect = () => {
    const [width, height] = String(byId('setting-default-canvas-size')?.value || '800x600').split('x').map(Number);
    if (Number.isFinite(width) && width > 0) byId('setting-default-canvas-width').value = width;
    if (Number.isFinite(height) && height > 0) byId('setting-default-canvas-height').value = height;
  };

  const syncDefaultZoomInputFromSelect = () => {
    const value = Number(byId('setting-default-zoom')?.value);
    if (Number.isFinite(value) && value > 0) byId('setting-default-zoom-custom').value = value;
  };
const applySavedSettings = () => {
    const saved = readSettings();
    const setChecked = (id, value) => {
      const node = byId(id);
      if (node) node.checked = value;
    };
    setChecked('setting-dark-mode', Boolean(saved.darkMode));
    setChecked('setting-show-status-bar', saved.showStatusBar !== false);
    setChecked('setting-show-color-inspector', saved.showColorInspector !== false);
    setChecked('setting-show-ai-chat', saved.showAiChat === true);
    const directionSelect = byId('setting-direction');
    if (directionSelect) directionSelect.value = ['auto', 'ltr', 'rtl'].includes(saved.interfaceDirection)
      ? saved.interfaceDirection : 'auto';
    const bgSelect = byId('setting-canvas-bg');
    bgSelect.value = saved.canvasBackground || 'none';
    const solidColor = /^#[0-9a-f]{6}$/i.test(saved.solidBackgroundColor || '')
      ? saved.solidBackgroundColor.toLowerCase()
      : DEFAULT_SETTINGS.solidBackgroundColor;
    if (byId('setting-solid-background-color')) byId('setting-solid-background-color').value = solidColor;
    canvasManager.setBackgroundColor(solidColor);
    const sizeSelect = byId('setting-default-canvas-size');
    sizeSelect.value = saved.defaultCanvasSize || '800x600';
    if (byId('setting-restore-last-image')) byId('setting-restore-last-image').checked = saved.restoreLastImage === true;
    if (![...sizeSelect.options].some((option) => option.value === sizeSelect.value)) sizeSelect.value = 'custom';
    if (Number(saved.defaultCanvasWidth) > 0) byId('setting-default-canvas-width').value = saved.defaultCanvasWidth;
    if (Number(saved.defaultCanvasHeight) > 0) byId('setting-default-canvas-height').value = saved.defaultCanvasHeight;
    if (sizeSelect.value !== 'custom') syncDefaultCanvasInputsFromSelect();
    const zoomSelect = byId('setting-default-zoom');
    const savedZoom = Number(saved.defaultZoom || 100);
    zoomSelect.value = [...zoomSelect.options].some((option) => option.value === String(savedZoom))
      ? String(savedZoom)
      : 'custom';
    byId('setting-default-zoom-custom').value = Math.min(800, Math.max(10, Math.round(savedZoom)));
    applyCanvasBackgroundMode(bgSelect.value);
    viewportManager.setInitialZoom(getDefaultZoom());
    if (!localStorage.getItem('paint:zoom')) viewportManager.setZoom(getDefaultZoom());
    // Startup begins from the configured blank size. app.js restores the
    // canonical IndexedDB working record afterwards, so this must not inspect
    // the retired localStorage canvas key or restore timing would depend on
    // stale fallback data.
    const { width, height } = getDefaultCanvasSize();
    if (width !== canvasManager.width || height !== canvasManager.height) canvasManager.resize(width, height);
    syncHistoryControls(saved);
    document.body.classList.toggle('dark-mode', Boolean(saved.darkMode));
    localeController.setDirection(directionSelect?.value || 'auto');
    document.querySelector('.status-bar').style.display = saved.showStatusBar !== false ? 'grid' : 'none';
    document.getElementById('color-inspector').style.display = saved.showColorInspector !== false ? 'flex' : 'none';
const ribbonVisibility = saved.ribbonVisibility || {};
    document.querySelectorAll('.ribbon-group').forEach((groupSection) => {
      const title = groupSection.querySelector('.ribbon-group-title');
      if (!title) return;
      const stableKey = getRibbonGroupKey(groupSection);
      const legacyKey = title.textContent.trim();
      const storedVisibility = ribbonVisibility[stableKey] ?? ribbonVisibility[legacyKey];
      if (storedVisibility === undefined) return;
      const visible = storedVisibility;
      groupSection.hidden = !visible;
      [...groupSection.children]
        .filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
        .forEach((child) => {
          child.hidden = !visible;
          child.style.display = visible ? '' : 'none';
        });
      const separator = groupSection.nextElementSibling;
      if (separator?.classList.contains('separator')) separator.style.display = visible ? '' : 'none';
    });
    const buttonVisibility = saved.buttonVisibility || {};
    document.querySelectorAll('.rbtn[id]').forEach((button) => {
      if (buttonVisibility[button.id] === undefined) return;
      button.hidden = !buttonVisibility[button.id];
      button.style.display = buttonVisibility[button.id] ? '' : 'none';
    });
    const fileInput = byId('file-input');
    if (fileInput) {
      fileInput.hidden = true;
      fileInput.style.display = 'none';
    }
    const rotateToggle = byId('rotate-selection-toggle');
    if (rotateToggle) rotateToggle.checked = saved.showRotateInSelection !== false;
    // Settings is the stable escape hatch for ribbon configuration.
    const settingsButton = byId('btn-settings');
    if (settingsButton) { settingsButton.hidden = false; settingsButton.style.display = ''; }
    const extrasGroup = document.querySelector('.ribbon-group-extras');
    if (extrasGroup) {
      extrasGroup.hidden = false;
      extrasGroup.style.display = '';
      [...extrasGroup.children]
        .filter((child) => !child.classList.contains('ribbon-group-title'))
        .forEach((child) => { child.hidden = false; child.style.display = child.classList.contains('rbtn-row') ? 'flex' : ''; });
    }
    applyAiChatVisibility(saved.showAiChat === true);
    const inspectorSeparator = document.querySelector('.color-inspector')?.nextElementSibling;
    if (inspectorSeparator?.classList.contains('separator')) {
      inspectorSeparator.style.display = saved.showColorInspector !== false ? '' : 'none';
    }
    renderShortcutSettings();
    const layout = saved.ribbonLayout || ribbonLayoutManager.state;
    ribbonLayoutManager.setPosition(layout.position || 'top');
    ribbonLayoutManager.setVisible(layout.visible !== false);
    if (settingsShowRibbon) settingsShowRibbon.checked = ribbonLayoutManager.state.visible;
    syncRibbonLayoutControls(ribbonLayoutManager.state);
    renderSegmentedChoices();
    syncRibbonSettingsControls();
  };

  // Locale changes re-render the JS-owned surfaces that are not data-i18n
  // nodes: the segmented choices, the history preferences row, and the app
  // state slices every mirror subscribes to.
  const onLocaleChange = (event) => {
    renderSegmentedChoices();
    // History preferences row: re-run both syncs so the auto-save state and the
    // limit summary are rendered in the new language too.
    syncHistoryControls();
    syncHistoryLimitSelect(Number(readSettings().historyLimit ?? DEFAULT_SETTINGS.historyLimit));
    appState.dispatch({ type: 'locale/changed', payload: event.detail?.locale ?? null });
    appState.dispatch({ type: 'direction/changed', payload: event.detail?.direction ?? document.documentElement.dir });
  };
  document.documentElement?.addEventListener('paint:locale-change', onLocaleChange);

  const destroy = () => {
    document.documentElement?.removeEventListener('paint:locale-change', onLocaleChange);
  };

  return Object.freeze({
    applySavedSettings,
    renderSegmentedChoices,
    applyCanvasBackgroundMode,
    getDefaultZoom,
    syncDefaultCanvasInputsFromSelect,
    syncDefaultZoomInputFromSelect,
    destroy,
  });
};
