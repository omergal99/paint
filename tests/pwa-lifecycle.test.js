import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { createPwaInstallManager } from '../js/pwa/PwaInstallManager.js';

const root = path.resolve(import.meta.dirname, '..');

const replaceGlobal = (name, value) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  return () => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else Reflect.deleteProperty(globalThis, name);
  };
};

const eventTarget = () => {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      const handlers = listeners.get(type) || new Set();
      handlers.add(listener);
      listeners.set(type, handlers);
    },
    removeEventListener(type, listener) {
      const handlers = listeners.get(type);
      handlers?.delete(listener);
      if (handlers?.size === 0) listeners.delete(type);
    },
    listenerCount() {
      return [...listeners.values()].reduce((total, handlers) => total + handlers.size, 0);
    },
    dispatch(type, event = {}) {
      [...(listeners.get(type) || [])].forEach((listener) => listener(event));
    },
  };
};

test('a waiting service-worker update is immediately described as ready', (t) => {
  const restoreNavigator = replaceGlobal('navigator', { serviceWorker: { controller: {} } });
  t.after(restoreNavigator);

  const statusEl = { textContent: '', dataset: {} };
  const updateButton = { disabled: false, textContent: '' };
  const registration = {
    waiting: { postMessage() {} },
    addEventListener() {},
    update: async () => {},
  };

  const manager = createPwaInstallManager({ statusEl, updateButton });
  manager.attachRegistration(registration);

  assert.equal(updateButton.disabled, false);
  assert.equal(updateButton.textContent, 'Update now');
  assert.equal(statusEl.dataset.state, 'update-ready');
  assert.match(statusEl.textContent, /Finish the current edit/);
  assert.match(statusEl.textContent, /Update now/);
});

test('applying a waiting update keeps the applying status visible', async (t) => {
  const restoreNavigator = replaceGlobal('navigator', { serviceWorker: { controller: {} } });
  t.after(restoreNavigator);

  let skipWaitingCalls = 0;
  const statusEl = { textContent: '', dataset: {} };
  const registration = {
    waiting: {
      postMessage(message) {
        if (message.type === 'SKIP_WAITING') skipWaitingCalls += 1;
      },
    },
    addEventListener() {},
    update: async () => {},
  };
  const manager = createPwaInstallManager({ statusEl, updateButton: { disabled: false, textContent: '' } });
  manager.attachRegistration(registration);

  await manager.checkForUpdate();

  assert.equal(skipWaitingCalls, 1);
  assert.equal(statusEl.dataset.state, 'updating');
  assert.match(statusEl.textContent, /Applying the update/);
});

test('a waiting update stays waiting while reloading would lose an active edit', async (t) => {
  const restoreNavigator = replaceGlobal('navigator', { serviceWorker: { controller: {} } });
  t.after(restoreNavigator);

  let skipWaitingCalls = 0;
  const statusEl = { textContent: '', dataset: {} };
  const registration = {
    waiting: {
      postMessage(message) {
        if (message.type === 'SKIP_WAITING') skipWaitingCalls += 1;
      },
    },
    addEventListener() {},
    update: async () => {},
  };
  const manager = createPwaInstallManager({
    statusEl,
    updateButton: { disabled: false, textContent: '' },
    canReload: () => false,
  });
  manager.attachRegistration(registration);

  assert.equal(await manager.checkForUpdate(), false);
  assert.equal(skipWaitingCalls, 0);
  assert.equal(statusEl.dataset.state, 'update-ready');
  assert.match(statusEl.textContent, /Finish the current edit/);
});

test('a waiting update flushes a pending autosave before skip-waiting', async (t) => {
  const restoreNavigator = replaceGlobal('navigator', { serviceWorker: { controller: {} } });
  t.after(restoreNavigator);

  let skipWaitingCalls = 0;
  let prepareCalls = 0;
  let safeToReload = false;
  const statusEl = { textContent: '', dataset: {} };
  const registration = {
    waiting: {
      postMessage(message) {
        if (message.type === 'SKIP_WAITING') skipWaitingCalls += 1;
      },
    },
    addEventListener() {},
    update: async () => {},
  };
  const manager = createPwaInstallManager({
    statusEl,
    updateButton: { disabled: false, textContent: '' },
    requireReloadGuard: true,
  });
  manager.setReloadGuard({
    isSafeToReload: () => safeToReload,
    getState: () => ({ reason: 'autosave-pending' }),
    async prepareForReload() {
      prepareCalls += 1;
      safeToReload = true;
      return { ok: true };
    },
  });
  manager.attachRegistration(registration);

  assert.equal(await manager.checkForUpdate(), true);
  assert.equal(prepareCalls, 1);
  assert.equal(skipWaitingCalls, 1, 'activation starts only after the guard reports a durable canvas');
  assert.equal(statusEl.dataset.state, 'updating');
});

test('a failed or unavailable autosave guard blocks skip-waiting', async (t) => {
  const restoreNavigator = replaceGlobal('navigator', { serviceWorker: { controller: {} } });
  t.after(restoreNavigator);

  let skipWaitingCalls = 0;
  const statusEl = { textContent: '', dataset: {} };
  const registration = {
    waiting: {
      postMessage(message) {
        if (message.type === 'SKIP_WAITING') skipWaitingCalls += 1;
      },
    },
    addEventListener() {},
    update: async () => {},
  };
  const manager = createPwaInstallManager({
    statusEl,
    updateButton: { disabled: false, textContent: '' },
    requireReloadGuard: true,
  });
  manager.attachRegistration(registration);

  assert.equal(await manager.checkForUpdate(), false, 'production hosts fail closed before autosave starts');
  assert.equal(skipWaitingCalls, 0);
  assert.match(statusEl.textContent, /Autosave is still starting/);

  manager.setReloadGuard({
    isSafeToReload: () => false,
    getState: () => ({ reason: 'autosave-failed' }),
    async prepareForReload() {
      return { ok: false, reason: 'autosave-failed' };
    },
  });
  assert.equal(await manager.checkForUpdate(), false);
  assert.equal(skipWaitingCalls, 0);
  assert.equal(statusEl.dataset.state, 'update-blocked');
  assert.match(statusEl.textContent, /Autosave has not finished safely/);
});

test('a controller change never reloads over an unsafe canvas', async (t) => {
  let reloadCalls = 0;
  const serviceWorker = {
    ...eventTarget(),
    controller: {},
    ready: Promise.resolve(null),
    getRegistration: async () => null,
  };
  const windowTarget = {
    ...eventTarget(),
    matchMedia: () => ({ matches: false }),
    location: { reload: () => { reloadCalls += 1; } },
  };
  const documentTarget = { ...eventTarget(), hidden: false };
  const restoreNavigator = replaceGlobal('navigator', { serviceWorker });
  const restoreWindow = replaceGlobal('window', windowTarget);
  const restoreDocument = replaceGlobal('document', documentTarget);
  t.after(() => {
    restoreDocument();
    restoreWindow();
    restoreNavigator();
  });

  const statusEl = { textContent: '', dataset: {} };
  const manager = createPwaInstallManager({
    statusEl,
    requireReloadGuard: true,
  });
  manager.setReloadGuard({
    isSafeToReload: () => false,
    getState: () => ({ reason: 'autosave-saving' }),
    prepareForReload: async () => ({ ok: false, reason: 'autosave-saving' }),
  });
  manager.start();
  serviceWorker.dispatch('controllerchange');

  assert.equal(reloadCalls, 0);
  assert.match(statusEl.textContent, /Saving the latest canvas change/);
  manager.destroy();
});

test('a failed offline-cache response never reports offline readiness', async (t) => {
  class FakeMessageChannel {
    constructor() {
      this.port1 = { onmessage: null };
      this.port2 = { peer: this.port1 };
    }
  }

  const restoreNavigator = replaceGlobal('navigator', { serviceWorker: { controller: null } });
  const restoreWindow = replaceGlobal('window', {
    clearTimeout,
    setTimeout,
  });
  const restoreMessageChannel = replaceGlobal('MessageChannel', FakeMessageChannel);
  t.after(() => {
    restoreMessageChannel();
    restoreWindow();
    restoreNavigator();
  });

  const offlineStatusEl = { textContent: '', dataset: {} };
  const registration = {
    active: {
      postMessage(_message, [port]) {
        port.peer.onmessage({ data: { ok: false, cached: 59, failed: 1 } });
      },
    },
    addEventListener() {},
    update: async () => {},
  };
  const manager = createPwaInstallManager({ offlineStatusEl });
  manager.attachRegistration(registration);

  assert.equal(await manager.prepareOffline(), false);
  assert.equal(offlineStatusEl.dataset.state, 'error');
  assert.match(offlineStatusEl.textContent, /needs a connection/i);
  assert.doesNotMatch(offlineStatusEl.textContent, /ready/i);
});

test('PWA manager releases its browser and control listeners on destroy', (t) => {
  const windowTarget = { ...eventTarget(), matchMedia: () => ({ matches: false }) };
  const documentTarget = { ...eventTarget(), hidden: false };
  const restoreWindow = replaceGlobal('window', windowTarget);
  const restoreDocument = replaceGlobal('document', documentTarget);
  const restoreNavigator = replaceGlobal('navigator', {});
  t.after(() => {
    restoreNavigator();
    restoreDocument();
    restoreWindow();
  });

  const installButton = eventTarget();
  const updateButton = eventTarget();
  const offlineButton = eventTarget();
  const manager = createPwaInstallManager({ installButton, updateButton, offlineButton });
  manager.start();

  assert.equal(windowTarget.listenerCount(), 2, 'window install listeners are owned by the manager');
  assert.equal(documentTarget.listenerCount(), 1, 'visibility listener is owned by the manager');
  assert.equal(installButton.listenerCount(), 1);
  assert.equal(updateButton.listenerCount(), 1);
  assert.equal(offlineButton.listenerCount(), 1);

  manager.destroy();
  assert.equal(windowTarget.listenerCount(), 0);
  assert.equal(documentTarget.listenerCount(), 0);
  assert.equal(installButton.listenerCount(), 0);
  assert.equal(updateButton.listenerCount(), 0);
  assert.equal(offlineButton.listenerCount(), 0);
});

test('service-worker activation only clears prior Paint shell caches', async () => {
  const serviceWorkerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const currentCacheName = serviceWorkerSource.match(/const CACHE_NAME = '([^']+)'/)?.[1];
  assert.ok(currentCacheName, 'service worker cache name is missing');
  const listeners = new Map();
  const deleted = [];
  let claimCalls = 0;
  const context = {
    caches: {
      async keys() {
        return ['paint-shell-previous', currentCacheName, 'unrelated-app-cache'];
      },
      async delete(key) {
        deleted.push(key);
        return true;
      },
    },
    console: { warn() {} },
    self: {
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      clients: {
        async claim() {
          claimCalls += 1;
        },
      },
    },
  };
  vm.runInNewContext(serviceWorkerSource, context, { filename: 'sw.js' });

  let activation;
  listeners.get('activate')({
    waitUntil(promise) {
      activation = promise;
    },
  });
  await activation;

  assert.deepEqual(deleted, ['paint-shell-previous']);
  assert.equal(claimCalls, 1);
});

test('service-worker install rejects an incomplete shell without forcing activation', async () => {
  const serviceWorkerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const listeners = new Map();
  let skipWaitingCalls = 0;
  const context = {
    caches: {
      async open() {
        return {
          async match() { return null; },
          async add() { throw new Error('network unavailable'); },
        };
      },
    },
    console: { warn() {} },
    self: {
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      skipWaiting() {
        skipWaitingCalls += 1;
      },
    },
  };
  vm.runInNewContext(serviceWorkerSource, context, { filename: 'sw.js' });

  let installation;
  listeners.get('install')({
    waitUntil(promise) {
      installation = promise;
    },
  });

  await assert.rejects(installation, /Offline shell has .* unavailable asset/);
  assert.equal(skipWaitingCalls, 0);
});
