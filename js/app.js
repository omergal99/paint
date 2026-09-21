import {
  clearCanvasState,
  installCanvasAutosave,
  loadCanvasState,
  saveCanvasState,
  STORAGE_FAILURE_KINDS,
  WORKING_CANVAS_MAX_AGE_MS,
} from './storage.js';
import { installTelemetry } from './telemetry.js';
import { APP_VERSION } from './version.js';

const canvas = document.getElementById('paint-canvas');
const presentedStorageFailures = new Set();
let canvasManager = null;
let eventBus = null;
let statusBar = null;
let dialogService = null;
let destroyEditor = null;
let setPwaUpdateSafetyGuard = null;
let shouldRestoreLastImage = () => false;

// The static shell paints immediately, then main.js applies saved layout,
// locale, and ribbon visibility. Mask that short reconciliation window so the
// ribbon never visibly jumps between defaults and the user's saved layout.
// Flip this single constant to false if the product prefers the instant shell.
const RIBBON_STARTUP_MASK_ENABLED = true;
// Development preview only: append `?debugLoading=1&loadingMs=1500` to hold
// the startup mask for 1.5s after Paint is ready. Without the explicit flag,
// production behavior remains event-driven and adds no artificial delay.
const getDebugLoadingDelay = () => {
  const params = new URLSearchParams(globalThis.location?.search || '');
  if (params.get('debugLoading') !== '1') return 0;
  const value = Number(params.get('loadingMs'));
  return Number.isFinite(value) ? Math.min(10000, Math.max(0, Math.round(value))) : 0;
};
const RIBBON_STARTUP_MASK_DELAY_MS = getDebugLoadingDelay();
const ribbon = document.getElementById('ribbon');
let ribbonMaskReleased = false;
const releaseRibbonStartupMask = () => {
  if (ribbonMaskReleased) return;
  ribbonMaskReleased = true;
  ribbon?.classList.remove('ribbon-loading');
};
const releaseRibbonStartupMaskAfterReady = () => {
  if (RIBBON_STARTUP_MASK_DELAY_MS > 0) {
    window.setTimeout(releaseRibbonStartupMask, RIBBON_STARTUP_MASK_DELAY_MS);
    return;
  }
  releaseRibbonStartupMask();
};
if (ribbon) {
  if (RIBBON_STARTUP_MASK_ENABLED) {
    window.addEventListener('paint:ready', releaseRibbonStartupMaskAfterReady, { once: true });
  } else {
    releaseRibbonStartupMask();
  }
}

const currentCanvasMetadata = () => ({
  width: canvasManager.width,
  height: canvasManager.height,
});

const downloadRecoveryCopy = async () => {
  const blob = await canvasManager.toBlob('image/png');
  if (!(blob instanceof Blob) || !globalThis.URL?.createObjectURL) throw new Error('PNG download is unavailable');
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'paint-recovery.png';
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // The click consumes the URL synchronously in supported browsers. Revoke
    // it on the next task so the download is not stranded in app memory.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
};

const showStorageFailure = async (failure, { onDiscard = null } = {}) => {
  if (!failure) return false;
  if (presentedStorageFailures.has(failure.kind)) return false;
  presentedStorageFailures.add(failure.kind);
	statusBar.flash(failure.message || 'Autosave could not finish. Your image is still open.');

  if (failure.kind === STORAGE_FAILURE_KINDS.quota) {
    const download = await dialogService.confirm({
      title: 'Autosave storage is full',
      message: 'Your image is still open. Download a PNG copy now before continuing.',
      confirmLabel: 'Download now',
      cancelLabel: 'Keep editing',
    });
    if (!download) return false;
    try {
      await downloadRecoveryCopy();
      statusBar.flash('Recovery PNG downloaded');
      return true;
    } catch (error) {
      console.warn('Recovery PNG download failed:', error);
      statusBar.flash('Could not download a recovery PNG');
      return false;
    }
  }

  if ((failure.kind === STORAGE_FAILURE_KINDS.corrupt || failure.kind === STORAGE_FAILURE_KINDS.database) && onDiscard) {
    const discard = await dialogService.confirm({
      title: failure.kind === STORAGE_FAILURE_KINDS.corrupt ? 'Damaged autosave found' : 'Autosave needs reset',
      message: failure.kind === STORAGE_FAILURE_KINDS.corrupt
        ? 'The saved recovery image cannot be read. Discard that autosave? Your currently open image will not be changed.'
        : 'Paint could not open its autosave database. Reset only the autosave record and keep the current image open?',
      confirmLabel: 'Reset autosave',
      cancelLabel: 'Keep it',
      danger: true,
    });
    if (!discard) return false;
    const result = await onDiscard();
    if (result?.ok) {
      statusBar.flash('Damaged autosave was removed');
      return true;
    }
    statusBar.flash(result?.failure?.message || 'Autosave could not be reset');
  }
  return false;
};

const restoreWorkingCanvas = async () => {
  const result = await loadCanvasState({ maxAgeMs: WORKING_CANVAS_MAX_AGE_MS });
  if (!result.ok) {
    await showStorageFailure(result.failure, { onDiscard: clearCanvasState });
    return false;
  }
  if (result.record) {
    const restored = await canvasManager.loadImageBlob(result.record.blob, result.record.width, result.record.height);
    if (restored) {
      statusBar.flash(result.legacy ? 'Restored recent image (upgrading autosave)' : 'Restored recent image');
      return true;
    }
    await showStorageFailure({
      kind: STORAGE_FAILURE_KINDS.corrupt,
      message: 'Saved recovery data is damaged. Your open image is still safe.',
    }, { onDiscard: clearCanvasState });
    return false;
  }

  // LocalStorage was the former working-document store. It is read exactly
  // once only when IndexedDB has no usable current record, then removed only
  // after a successful Blob save. We never write the enormous data URL again.
  const restoredLegacy = await canvasManager.restoreLegacyFromStorage({ maxAgeMs: WORKING_CANVAS_MAX_AGE_MS });
  if (!restoredLegacy) return false;
  const promoted = await saveCanvasState({
    getBlob: () => canvasManager.toBlob('image/png'),
    metadata: currentCanvasMetadata(),
  });
  if (promoted.ok) {
    canvasManager.clearStoredState();
    statusBar.flash('Restored recent image');
  } else {
    await showStorageFailure(promoted.failure);
  }
  return true;
};

const startEditorRuntime = async () => {
  ({ canvasManager, eventBus, statusBar, dialogService, destroyEditor, setPwaUpdateSafetyGuard, shouldRestoreLastImage } = await import('./main.js'));
  const disposeAutosave = installCanvasAutosave({
    canvas,
    eventBus,
    getBlob: () => canvasManager.toBlob('image/png'),
    getMetadata: currentCanvasMetadata,
    onResult: (result) => {
      if (result.ok) presentedStorageFailures.clear();
    },
    onError: (failure) => { void showStorageFailure(failure); },
  });
  setPwaUpdateSafetyGuard?.({
    isSafeToReload: disposeAutosave.isSafeToReload,
    getState: disposeAutosave.getState,
    prepareForReload: disposeAutosave.prepareForReload,
  });
  const telemetry = installTelemetry({
    onMetric: (name, value) => {
      if (name === 'error' || name === 'unhandled-rejection') {
        console.error(`[paint:${name}]`, value);
      }
    },
  });
  const flushAutosave = () => { void disposeAutosave.flush?.(); };
  const onVisibilityChange = () => {
    if (document.hidden) flushAutosave();
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', (event) => {
    flushAutosave();
    if (event.persisted) telemetry.pause();
    else {
      telemetry.destroy();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      disposeAutosave();
      destroyEditor?.();
      eventBus.destroy();
    }
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) telemetry.resume();
  });

  // Startup is blank by default. When the History preference opts in, the
  // IndexedDB recovery decision completes before `paint:ready` fires.
  const restore = shouldRestoreLastImage();
  void (restore ? restoreWorkingCanvas() : Promise.resolve(false))
    .catch((error) => {
      console.warn('Unable to restore working canvas:', error);
      return showStorageFailure({ kind: STORAGE_FAILURE_KINDS.database, message: 'Autosave could not open. Your image is still open.' }, { onDiscard: clearCanvasState });
    })
    .finally(() => window.dispatchEvent(new CustomEvent('paint:ready')));
};

if (canvas) {
  // The static shell already contains the first useful Paint frame. Yield one
  // browser paint before importing the large editor graph so slow mobile
  // navigation does not make controls such as the canvas-size status become
  // the delayed LCP candidate. The app remains native ES modules-this is a
  // measured scheduling boundary, not a bundler/runtime dependency.
  const launch = () => {
    void startEditorRuntime().catch((error) => {
      console.error('Paint editor startup failed:', error);
      window.dispatchEvent(new CustomEvent('paint:ready'));
    });
  };
  const schedule = globalThis.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
  schedule(() => window.setTimeout(launch, 0));
}

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', async () => {
    try {
      const workerUrl = `./sw.js?version=${encodeURIComponent(APP_VERSION)}`;
      await navigator.serviceWorker.register(workerUrl, { scope: './' });
    } catch (error) {
      console.warn('Offline mode unavailable:', error);
    }
  }, { once: true });
}
