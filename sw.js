const CACHE_NAME = 'paint-shell-v1-8-0-da1307b9';
const CACHE_PREFIX = 'paint-shell-';
const SHELL = [
  './index.html',
  './manifest.json',
  './css/progressive.css',
  './css/styles.css',
  './js/app.js',
  './js/version.js',
  './js/ai/DeterministicCommandService.js',
  './js/ai/AiConnectionStore.js',
  './js/main.js',
  './js/background/BackgroundRemovalProvider.js',
  './js/background/LocalColorKeyProvider.js',
  './js/background/BackgroundRemovalController.js',
  './js/background/BackgroundMaskEditor.js',
  './js/session/SessionService.js',
  './js/ui/TabBar.js',
  './js/ui/SplitView.js',
  './js/ui/WorkspaceStrip.js',
  './js/i18n/localeRegistry.js',
  './js/i18n/messages.js',
  './js/i18n/uiText.js',
  './js/i18n/catalogs/es.js',
  './js/i18n/catalogs/catalogFactory.js',
  './js/i18n/catalogs/pt-br.js',
  './js/i18n/catalogs/fr.js',
  './js/i18n/catalogs/de.js',
  './js/i18n/catalogs/ar.js',
  './js/i18n/catalogs/ja.js',
  './js/i18n/catalogs/he.js',
  './js/utils/datetime.js',
  './js/i18n/LocaleController.js',
  './js/core/constants.js',
  './js/core/EventBus.js',
  './js/core/DocumentContract.js',
  './js/document/TextDocumentStore.js',
  './js/document/TextHistoryStore.js',
  './js/document/TextLayerRenderer.js',
  './js/document/TextLayerService.js',
  './js/storage.js',
  './js/storage/MemoryBudget.js',
  './js/storage/ImageAdmission.js',
  './js/telemetry.js',
  './js/canvas/CanvasManager.js',
  './js/canvas/CanvasResizer.js',
  './js/canvas/ViewportManager.js',
  './js/clipboard/ClipboardManager.js',
  './js/history/HistoryManager.js',
  './js/history/GlobalHistory.js',
  './js/tools/ToolManager.js',
  './js/tools/FreehandTools.js',
  './js/tools/FillTool.js',
  './js/tools/ShapeTool.js',
  './js/tools/TextTool.js',
  './js/tools/EyedropperTool.js',
  './js/tools/ZoomTool.js',
  './js/tools/PanTool.js',
  './js/tools/SelectTool.js',
  './js/ui/ColorPalette.js',
  './js/ui/ActionMenuController.js',
  './js/ui/BrowserInfoPanel.js',
  './js/ui/CheckboxRowController.js',
  './js/ui/DialogSearch.js',
  './js/ui/HistoryPanel.js',
  './js/ui/SettingsDialog.js',
  './js/ui/ColorInspector.js',
  './js/ui/StatusBar.js',
  './js/ui/DialogService.js',
  './js/ui/Toolbar.js',
  './js/ui/SliderControl.js',
  './js/tools/EmojiStore.js',
  './js/releaseNotes.js',
  './js/pwa/PwaInstallManager.js',
  './js/ui/Sidebar.js',
  './js/ui/RibbonMirror.js',
  './js/ui/mirrors/fileMirror.js',
  './js/ui/mirrors/clipboardMirror.js',
  './js/ui/mirrors/imageMirror.js',
  './js/ui/mirrors/toolsMirror.js',
  './js/ui/mirrors/shapesMirror.js',
  './js/ui/mirrors/colorsMirror.js',
  './js/ui/mirrors/extrasMirror.js',
  './js/ui/mirrors/historyMirror.js',
  './js/ui/mirrors/lineSizeControl.js',
  './js/settings/SettingsRegistry.js',
  './js/settings/SettingsStore.js',
  './js/settings/ShortcutManager.js',
  './js/ui/PanelLayoutManager.js',
  './js/ui/SegmentedChoice.js',
  './js/ui/TextSelectionOverlay.js',
  './js/utils/color.js',
  './js/utils/colorContract.js',
  './js/utils/transform.js',
  './js/app/appState.js',
  './js/app/canvasTransforms.js',
  './js/app/fileActions.js',
  './js/app/historyControls.js',
  './js/app/resizeDialog.js',
  './js/app/router.js',
  './js/app/settingsStore.js',
  './js/app/aboutPanel.js',
  './js/app/settingsRegistry.js',
  './js/app/shortcutSettings.js',
  './js/app/bootTiming.js',
  './js/app/ribbonSettings.js',
  './js/app/settingsHydration.js',
  './js/ui/segmentedChoices.js',
  './js/services/clipboard/clipboardService.js',
  './js/services/selection/selectionAppearance.js',
  './js/services/selection/selectionSettings.js',
  './js/services/selection/selectionPreview.js',
  './js/services/selection/selectionPropertiesPanel.js',
  './js/app/CommandRegistry.js',
  './js/app/GlobalShortcutController.js',
  './js/ui/FontFamilyPicker.js',
  './js/app/imageDropController.js',
  './js/app/selectionModeController.js',
  './js/app/selectionOverlayController.js',
  './js/services/selection/selectionGeometry.js',
  './js/canvas/AdjustmentEngine.js',
  './js/ui/RecentTextDropdown.js',
  './js/canvas/AdjustmentService.js',
  './js/canvas/BrushAreaMask.js',
  './js/tools/AdjustmentMaskTool.js',
  './js/ui/AdjustmentEntries.js',
  './js/ui/AdjustmentsDialog.js',
  './js/ui/BrushCursorOverlay.js',
  './css/assets/icon.svg',
  './css/assets/icon-192.png',
  './css/assets/icon-512.png',
  './css/assets/icon-512-maskable.png',
  './css/assets/preview.png',
];

const cacheShell = async () => {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.allSettled(SHELL.map(async (asset) => {
    // Always re-fetch first: a cache name stays the same across content
    // changes, so trusting a previous entry would keep serving a stale module
    // until someone hand-bumped the cache name. Offline installs fall back to
    // the known-good copy instead of failing.
    try {
      await cache.add(asset);
      return;
    } catch (error) {
      if (await cache.match(asset)) return;
      throw error;
    }
  }));
  const failed = results.reduce((count, result) => count + (result.status === 'rejected' ? 1 : 0), 0);
  return { ok: failed === 0, cached: SHELL.length - failed, failed };
};

const cacheShellForInstall = async () => {
  const result = await cacheShell();
  if (result.ok) return result;
  // Do not activate an incomplete candidate or let it displace the previous
  // known-good shell. A future update can retry the install and fill any
  // partial candidate cache without deleting the active cache.
  throw new Error(`Offline shell has ${result.failed} unavailable asset(s).`);
};

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShellForInstall());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CACHE_ALL') {
    event.waitUntil(
      cacheShell()
        .catch(() => ({ ok: false, cached: 0, failed: SHELL.length }))
        .then((result) => event.ports[0]?.postMessage(result)),
    );
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((cached) => {
    if (cached) return cached;
    return event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error();
  })));
});
