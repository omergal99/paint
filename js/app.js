import { canvasManager } from './main.js';
import { installCanvasAutosave, loadCanvasState } from './storage.js';
import { installTelemetry } from './telemetry.js';

const canvas = document.getElementById('paint-canvas');

function hasLegacySession() {
  try {
    return Boolean(window.localStorage?.getItem('omerpaint:last-canvas'));
  } catch {
    return false;
  }
}

if (canvas) {
  installCanvasAutosave({ canvas });
  installTelemetry({
    onMetric: (name, value) => {
      if (name === 'error' || name === 'unhandled-rejection') {
        console.error(`[paint:${name}]`, value);
      }
    },
  });
  loadCanvasState().then(async (state) => {
    if (!state?.blob || hasLegacySession()) return;
    const url = URL.createObjectURL(state.blob);
    try {
      await canvasManager.loadImageDataUrl(url, state.width, state.height);
      window.dispatchEvent(new CustomEvent('paint:restored', { detail: state }));
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  window.dispatchEvent(new CustomEvent('paint:ready'));
}

if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((error) => {
    console.warn('Offline mode unavailable:', error);
  }), { once: true });
}
