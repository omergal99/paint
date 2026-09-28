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
  updateStatusEl,
  updateButton,
  applyUpdateButton,
  offlineButton,
  offlineStatusEl,
  translate = (key, fallback) => fallback,
  canReload = () => true,
  requireReloadGuard = false,
} = {}) => {
  let deferredPrompt = null;
  let registration = null;
  let reloading = false;
  // True only after the user explicitly asked to apply an update. Every other
  // controller change is background noise and must never reload the page.
  let applying = false;
  let reloadGuard = null;
  let hadController = Boolean(navigator.serviceWorker?.controller);
  let started = false;
  let disposed = false;
  let watchedWorker = null;

  const setOfflineStatus = (message, state = '') => {
    if (!offlineStatusEl) return;
    offlineStatusEl.textContent = message;
    offlineStatusEl.dataset.state = state;
    offlineStatusEl.hidden = false;
  };

  const getReloadDecision = () => {
    if (!canReload()) return { ok: false, reason: 'active-edit' };
    if (!reloadGuard) {
      return requireReloadGuard
        ? { ok: false, reason: 'autosave-unavailable' }
        : { ok: true };
    }
    if (reloadGuard.isSafeToReload?.()) return { ok: true };
    const state = reloadGuard.getState?.();
    return { ok: false, reason: state?.reason || 'autosave-pending', state };
  };

  const setReloadBlockedStatus = ({ reason }) => {
    if (reason === 'autosave-failed') {
      setUpdateStatus(translate('ui.updateBlockedAutosaveFailed', 'Update ready. Autosave has not finished safely. Resolve the storage warning or download a copy before updating.'), 'update-blocked');
      return;
    }
    if (reason === 'autosave-unavailable') {
      setUpdateStatus(translate('ui.updateBlockedAutosaveStarting', 'Update ready. Autosave is still starting. Try again in a moment.'), 'update-blocked');
      return;
    }
    if (reason === 'autosave-disabled') {
      setUpdateStatus(translate('ui.updateBlockedAutosaveDisabled', 'Update ready. Automatic recovery is off. Save or download the image before updating.'), 'update-blocked');
      return;
    }
    if (reason === 'autosave-pending' || reason === 'autosave-saving') {
      setUpdateStatus(translate('ui.updateSaving', 'Update ready. Saving the latest canvas change before applying it.'), 'update-ready');
      return;
    }
    setUpdateStatus(translate('ui.updateFinishEdit', 'Update ready. Finish the current edit, then reload to apply it.'), 'update-ready');
  };

  const prepareReload = async () => {
    const initial = getReloadDecision();
    if (initial.ok || initial.reason === 'active-edit' || !reloadGuard?.prepareForReload) return initial;
    const prepared = await reloadGuard.prepareForReload();
    if (!prepared?.ok) {
      return {
        ok: false,
        reason: prepared?.reason || getReloadDecision().reason || 'autosave-pending',
        state: prepared?.state,
      };
    }
    return getReloadDecision();
  };

  const reloadIfSafe = () => {
    const decision = getReloadDecision();
    if (!decision.ok) {
      setReloadBlockedStatus(decision);
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
    statusEl.hidden = false;
  };

  const setUpdateStatus = (message, state = '') => {
    const output = updateStatusEl || statusEl;
    if (!output) return;
    output.textContent = message;
    output.dataset.state = state;
    output.hidden = false;
  };

  const setUpdateReadyStatus = () => {
    setUpdateStatus(translate('ui.updateReady', 'A new version is ready. Finish the current edit, then select Update now.'), 'update-ready');
  };

  const syncInstallUi = () => {
    const installed = isStandalone();
    if (installButton) {
      installButton.hidden = installed;
      installButton.disabled = installed;
    }
    if (installed) {
      setStatus(translate('ui.installStatusInstalled', 'Paint is installed on this device.'), 'installed');
    } else if (deferredPrompt) {
      setStatus(translate('ui.installStatusReady', 'Ready to install from this browser.'), 'ready');
    } else {
      setStatus(translate('ui.installStatusManual', 'Use your browser menu to install. On iPhone or iPad, use Share → Add to Home Screen.'), 'manual');
    }
  };

  // The check control is a pure check: it never skip-waits and never reloads.
  // Applying is a separate, user-initiated control that only appears once an
  // update is actually waiting.
  const syncUpdateUi = ({ announceReady = true } = {}) => {
    const waiting = Boolean(registration?.waiting);
    if (updateButton) {
      updateButton.disabled = !registration;
      updateButton.textContent = translate('ui.checkUpdates', 'Check for updates');
    }
    if (applyUpdateButton) {
      applyUpdateButton.hidden = !(waiting || applying);
      applyUpdateButton.disabled = !registration;
      applyUpdateButton.textContent = translate('ui.updateNow', 'Update now');
    }
    if (announceReady && waiting) setUpdateReadyStatus();
  };

  const syncOfflineUi = () => {
    if (!offlineButton) return;
    offlineButton.disabled = !registration;
    if (!registration) {
      setOfflineStatus(translate('ui.offlineUse', 'Offline use'), 'unavailable');
    } else if (offlineStatusEl?.dataset.state === 'unavailable') {
      setOfflineStatus(translate('ui.offlineShellReady', 'All current app features are included in the offline shell.'), 'ready');
    }
  };

  const onWorkerStateChange = () => {
    if (!watchedWorker || disposed) return;
    if (watchedWorker.state === 'installed' && navigator.serviceWorker.controller) {
      setUpdateReadyStatus();
      syncUpdateUi({ announceReady: false });
    }
  };

  const watchInstallingWorker = (worker) => {
    if (!worker || worker === watchedWorker || disposed) return;
    watchedWorker?.removeEventListener?.('statechange', onWorkerStateChange);
    watchedWorker = worker;
    worker.addEventListener('statechange', onWorkerStateChange);
  };

  const onUpdateFound = () => watchInstallingWorker(registration?.installing);

  const attachRegistration = (nextRegistration) => {
    if (!nextRegistration || registration === nextRegistration || disposed) return;
    registration?.removeEventListener?.('updatefound', onUpdateFound);
    registration = nextRegistration;
    registration.addEventListener('updatefound', onUpdateFound);
    watchInstallingWorker(registration.installing);
    syncUpdateUi();
    syncOfflineUi();
    // Ask the browser to compare sw.js immediately. This makes a published
    // release discoverable on the first foreground visit instead of waiting
    // for the browser's periodic service-worker check.
    registration.update?.().catch(() => {});
  };

  const onBeforeInstallPrompt = (event) => {
    event.preventDefault();
    deferredPrompt = event;
    syncInstallUi();
  };
  const onAppInstalled = () => {
    deferredPrompt = null;
    syncInstallUi();
  };
  const onVisibilityChange = () => {
    if (!document.hidden) registration?.update?.();
  };
  const onControllerChange = () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    // A new worker taking control is only ever a reload signal when this
    // session asked for it (Update now). Background activations just refresh
    // the status text so the user keeps control of the reload.
    if (!applying) {
      syncUpdateUi({ announceReady: false });
      return;
    }
    if (!reloadIfSafe()) applying = false;
  };

  /*
   * Event ownership is deliberately explicit: the app can now dispose a
   * document host without keeping browser-level PWA listeners alive.
   */
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener?.('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener?.('appinstalled', onAppInstalled);
    document.removeEventListener?.('visibilitychange', onVisibilityChange);
    installButton?.removeEventListener?.('click', install);
    updateButton?.removeEventListener?.('click', checkForUpdate);
    applyUpdateButton?.removeEventListener?.('click', applyUpdate);
    offlineButton?.removeEventListener?.('click', prepareOffline);
    navigator.serviceWorker?.removeEventListener?.('controllerchange', onControllerChange);
    registration?.removeEventListener?.('updatefound', onUpdateFound);
    watchedWorker?.removeEventListener?.('statechange', onWorkerStateChange);
    watchedWorker = null;
    registration = null;
    reloadGuard = null;
    applying = false;
  };

  // The document host binds this after its autosave controller is installed.
  // Keeping it optional makes the manager reusable, while requireReloadGuard
  // lets production hosts fail closed during startup.
  const setReloadGuard = (nextGuard) => {
    reloadGuard = nextGuard && typeof nextGuard.isSafeToReload === 'function' ? nextGuard : null;
    return Boolean(reloadGuard);
  };

  const prepareOffline = async () => {
    const worker = registration?.active || navigator.serviceWorker?.controller;
    if (!worker) {
      setOfflineStatus(translate('ui.offlineLoadFirst', 'Load Paint once while online before preparing offline use.'), 'unavailable');
      return false;
    }
    setOfflineStatus(translate('ui.offlinePreparing', 'Preparing all Paint features for offline use…'), 'checking');
    try {
      const channel = new MessageChannel();
      const result = await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Offline preparation timed out')), 10000);
        channel.port1.onmessage = (event) => {
          window.clearTimeout(timeout);
          resolve(event.data);
        };
        worker.postMessage({ type: 'CACHE_ALL' }, [channel.port2]);
      });
      if (!result?.ok) throw new Error('One or more app assets were unavailable');
      setOfflineStatus(translate('ui.offlinePrepared', 'Offline use is ready. Paint can open without internet.'), 'ready');
      return true;
    } catch {
      setOfflineStatus(translate('ui.offlineRetryOnline', 'Offline preparation needs a connection. Try again while online.'), 'error');
      return false;
    }
  };

  const install = async () => {
    if (!deferredPrompt) {
      if (!isStandalone()) {
        setStatus(translate('ui.installNoPrompt', 'This browser does not offer a direct install prompt. Use its browser menu to install Paint.'), 'manual');
      }
      return false;
    }
    const prompt = deferredPrompt;
    deferredPrompt = null;
    syncInstallUi();
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice?.outcome === 'accepted') setStatus(translate('ui.installing', 'Installing Paint…'), 'installing');
    else syncInstallUi();
  };

  // Ask the browser whether sw.js changed. Reporting is the whole job: an
  // up-to-date app keeps the page exactly as it is, and a waiting worker only
  // reveals the Update now control.
  const checkForUpdate = async () => {
    if (!registration) {
      setUpdateStatus(translate('ui.updateUnavailable', 'Update check is unavailable right now.'), 'error');
      return false;
    }
    setUpdateStatus(translate('ui.checkingUpdates', 'Checking for updates…'), 'checking');
    try {
      await registration.update();
    } catch {
      setUpdateStatus(translate('ui.updateUnavailable', 'Update check is unavailable right now.'), 'error');
      syncUpdateUi({ announceReady: false });
      return false;
    }
    if (registration.waiting) setUpdateReadyStatus();
    else setUpdateStatus(translate('ui.upToDate', 'Paint is up to date.'), 'current');
    syncUpdateUi({ announceReady: false });
    return true;
  };

  // The only path that activates a waiting worker or reloads the page, and it
  // runs exclusively from the user's Update now click.
  const applyUpdate = async () => {
    if (!registration) return false;
    if (!registration.waiting && !applying) {
      setUpdateStatus(translate('ui.upToDate', 'Paint is up to date.'), 'current');
      syncUpdateUi({ announceReady: false });
      return false;
    }
    const decision = await prepareReload();
    if (!decision.ok) {
      setReloadBlockedStatus(decision);
      syncUpdateUi({ announceReady: false });
      return false;
    }
    applying = true;
    if (registration.waiting) {
      setUpdateStatus(translate('ui.updateApplying', 'Applying the update…'), 'updating');
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      syncUpdateUi({ announceReady: false });
      return true;
    }
    // The worker already took control; only the reload is left.
    if (!reloadIfSafe()) applying = false;
    return applying;
  };

  const start = () => {
    if (started || disposed) return;
    started = true;
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    document.addEventListener('visibilitychange', onVisibilityChange);
    installButton?.addEventListener('click', install);
    updateButton?.addEventListener('click', checkForUpdate);
    applyUpdateButton?.addEventListener('click', applyUpdate);
    offlineButton?.addEventListener('click', prepareOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      navigator.serviceWorker.ready.then(attachRegistration).catch(() => {});
      navigator.serviceWorker.getRegistration?.().then(attachRegistration).catch(() => {});
    }

    syncInstallUi();
    syncUpdateUi();
    syncOfflineUi();
  };

  return Object.freeze({ start, install, checkForUpdate, applyUpdate, prepareOffline, attachRegistration, setReloadGuard, destroy });
};
