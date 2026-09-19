import { canvasManager } from './main.js';
import { installCanvasAutosave } from './storage.js';
import { installTelemetry } from './telemetry.js';
import { APP_VERSION } from './version.js';

const canvas = document.getElementById('paint-canvas');

if (canvas) {
  installCanvasAutosave({ canvas });
  installTelemetry({
    onMetric: (name, value) => {
      if (name === 'error' || name === 'unhandled-rejection') {
        console.error(`[paint:${name}]`, value);
      }
    },
  });
  // Navigation intentionally starts a clean document. Autosaved data remains
  // available to history/export flows instead of silently reopening in place.
  window.dispatchEvent(new CustomEvent('paint:ready'));
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
