// js/app/router.js
// One owner for URL state. Deep links (`?dialog=settings&tab=history`),
// dialog open/close updates, and history navigation all go through this service
// so no feature module pokes `window.location` on its own.
//
// The router knows about URL shape only - it never opens UI. Callers map a
// resolved deep link to their own opener (keeps dialog ownership where the
// dialog lives).

const readParams = (location = globalThis.location) => (
  new URLSearchParams(location?.search || '')
);

export const createRouter = ({ win = globalThis } = {}) => {
  const listeners = new Set();

  const notify = (reason) => {
    for (const listener of [...listeners]) {
      try { listener(reason); } catch (error) { console.warn('Router listener failed:', error); }
    }
  };

  const current = () => readParams(win.location);

  /** Query value without the `?` noise; null when absent. */
  const param = (name) => current().get(name);

  /** Build the current URL string with a params patch applied. */
  const buildUrl = (patch = {}) => {
    const params = current();
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') params.delete(key);
      else params.set(key, String(value));
    });
    const query = params.toString();
    return `${win.location.pathname}${query ? `?${query}` : ''}${win.location.hash}`;
  };

  /** Replace the current URL without adding a history entry (dialog state). */
  const replace = (patch = {}) => {
    win.history.replaceState(null, '', buildUrl(patch));
    notify('replace');
  };

  /** Push a new URL entry (real navigation; keep it rare). */
  const navigate = (url, { replace: shouldReplace = false } = {}) => {
    if (shouldReplace) win.history.replaceState(null, '', url);
    else win.history.pushState(null, '', url);
    notify(shouldReplace ? 'replace' : 'navigate');
  };

  /**
   * Dialog URLs are a small, well-known shape, so the router owns them:
   * `?dialog=<name>` plus `tab` (settings only). Closing removes both.
   */
  const setDialog = (dialog, { tab = null, extra = {} } = {}) => {
    const patch = {
      dialog: dialog || null,
      tab: dialog === 'settings' ? tab : null,
      ...extra,
    };
    replace(patch);
  };

  const closeDialog = () => setDialog(null);

  /**
   * Resolve a deep link into `{ dialog, tab, params }` without acting on it.
   * Callers decide what "settings" or "new" means for them.
   */
  const resolveDeepLink = () => {
    const params = current();
    const dialog = params.get('dialog');
    return {
      dialog: dialog || null,
      tab: params.get('tab') || null,
      params,
      embedded: params.get('embedded') === '1',
    };
  };

  const onChange = (listener) => {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const handlePopState = () => notify('popstate');
  win.addEventListener?.('popstate', handlePopState);

  return Object.freeze({
    current,
    param,
    buildUrl,
    replace,
    navigate,
    setDialog,
    closeDialog,
    resolveDeepLink,
    onChange,
    destroy: () => {
      win.removeEventListener?.('popstate', handlePopState);
      listeners.clear();
    },
  });
};

export const router = createRouter();