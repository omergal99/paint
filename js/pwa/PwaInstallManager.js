// Browser-native install and service-worker update seam.
// The app never fabricates an install prompt: browsers decide when the PWA is
// eligible, while this module keeps the Settings surface honest on desktop,
// Android, and iOS.

const isStandalone = () => (
  window.matchMedia?.('(display-mode: standalone)').matches === true
  || navigator.standalone === true
);

export const createPwaInstallManager = ({
  installButton,
  statusEl,
  updateButton,
  canReload = () => true,
} = {}) => {
  let deferredPrompt = null;
  let registration = null;
  let reloading = false;
  let hadController = Boolean(navigator.serviceWorker?.controller);

  const reloadIfSafe = () => {
    if (!canReload()) {
      setStatus('Update ready. Finish the current edit, then reload to apply it.', 'update-ready');
      return false;
    }
    if (reloading) return true;
    reloading = true;
    window.location.reload();
    return true;
  };

  const setStatus = (message, state = '') => {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.state = state;
  };

  const syncInstallUi = () => {
    const installed = isStandalone();
    if (installButton) {
      installButton.hidden = installed;
      installButton.disabled = installed || !deferredPrompt;
    }
    if (installed) {
      setStatus('Paint is installed on this device.', 'installed');
    } else if (deferredPrompt) {
      setStatus('Ready to install from this browser.', 'ready');
    } else {
      setStatus('Use your browser menu to install. On iPhone or iPad, use Share → Add to Home Screen.', 'manual');
    }
  };

  const syncUpdateUi = () => {
    if (!updateButton) return;
    updateButton.disabled = !registration;
    updateButton.textContent = registration?.waiting ? 'Update now' : 'Check for updates';
  };

  const watchInstallingWorker = (worker) => {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        setStatus('A new version is ready. It will apply automatically.', 'update-ready');
        syncUpdateUi();
      }
    });
  };

  const attachRegistration = (nextRegistration) => {
    if (!nextRegistration || registration === nextRegistration) return;
    registration = nextRegistration;
    registration.addEventListener('updatefound', () => watchInstallingWorker(registration.installing));
    watchInstallingWorker(registration.installing);
    syncUpdateUi();
    // Ask the browser to compare sw.js immediately. This makes a published
    // release discoverable on the first foreground visit instead of waiting
    // for the browser's periodic service-worker check.
    registration.update?.().catch(() => {});
  };

  const install = async () => {
    if (!deferredPrompt) return;
    const prompt = deferredPrompt;
    deferredPrompt = null;
    syncInstallUi();
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice?.outcome === 'accepted') setStatus('Installing Paint…', 'installing');
    else syncInstallUi();
  };

  const checkForUpdate = async () => {
    if (!registration) return;
    setStatus('Checking for updates…', 'checking');
    try {
      await registration.update();
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        setStatus('Applying the update…', 'updating');
      } else {
        setStatus('Paint is up to date.', 'current');
      }
    } catch {
      setStatus('Update check is unavailable right now.', 'error');
    }
    syncUpdateUi();
  };

  const start = () => {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPrompt = event;
      syncInstallUi();
    });
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      syncInstallUi();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) registration?.update?.();
    });
    installButton?.addEventListener('click', install);
    updateButton?.addEventListener('click', checkForUpdate);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) {
          hadController = true;
          return;
        }
        reloadIfSafe();
      });
      navigator.serviceWorker.ready.then(attachRegistration).catch(() => {});
      navigator.serviceWorker.getRegistration?.().then(attachRegistration).catch(() => {});
    }

    syncInstallUi();
    syncUpdateUi();
  };

  return Object.freeze({ start, install, checkForUpdate, attachRegistration });
};
