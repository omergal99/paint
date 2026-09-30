import assert from 'node:assert/strict';
import test from 'node:test';
import { createActionMenuController } from '../js/ui/ActionMenuController.js';
import { createBrowserInfoPanel, readBrowserInfo } from '../js/ui/BrowserInfoPanel.js';
import { createCheckboxRowController } from '../js/ui/CheckboxRowController.js';
import { EMOJI_CATALOG, renderEmojiGrid, syncEmojiSelection } from '../js/tools/EmojiStore.js';

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

// Controllers ask for optional targets with one comma-separated `closest()`
// call. A browser parses that selector list itself, so these stubs do too
// instead of comparing the raw string.
const closestInList = (expected) => (selectorList) => (
  String(selectorList).split(',').map((selector) => selector.trim()).includes(expected) ? {} : null
);

test('browser diagnostics use only browser-exposed values and do not infer private data', () => {
  const info = readBrowserInfo({
    navigatorRef: {
      userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
      userAgentData: { brands: [{ brand: 'Chrome', version: '120' }], platform: 'Linux', mobile: false },
      languages: ['en-US', 'fr'],
      hardwareConcurrency: 8,
      deviceMemory: 4,
      onLine: true,
    },
    screenRef: { width: 1920, height: 1080 },
    windowRef: { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 2 },
    translate: (key) => ({ 'ui.browserCores': 'cores', 'ui.browserGigabytes': 'GB', 'ui.browserOnline': 'Online' }[key] || key),
  });

  assert.equal(info.browser, 'Chrome 120');
  assert.equal(info.system, 'Linux');
  assert.equal(info.display, '1920 × 1080 · 1280 × 720');
  assert.equal(info.capacity, '8 cores · ~4 GB');
  assert.equal(info.online, 'Online');
  assert.equal(info.userAgent, 'Mozilla/5.0 Chrome/120.0.0.0');
  assert.equal(Object.hasOwn(info, 'ip'), false);
  assert.equal(Object.hasOwn(info, 'fingerprint'), false);
});

test('browser diagnostics listen for pointer movement only while active and clean up', async () => {
  const browserWindow = {
    ...eventTarget(),
    innerWidth: 800,
    innerHeight: 600,
    devicePixelRatio: 1,
    requestAnimationFrame(callback) {
      this.frames.push(callback);
      return this.frames.length;
    },
    cancelAnimationFrame() {},
    frames: [],
  };
  const browserNavigator = {
    userAgent: 'Example Browser',
    platform: 'Test OS',
    language: 'en',
    onLine: true,
    geolocation: {
      calls: 0,
      getCurrentPosition(success) {
        this.calls += 1;
        success({ coords: { latitude: 12.34567, longitude: -45.67891, accuracy: 9 } });
      },
    },
  };
  const values = ['browser', 'system', 'device', 'display', 'pixelRatio', 'capacity', 'languageZone', 'battery', 'online', 'pointer', 'userAgent']
    .map((name) => ({ dataset: { browserInfo: name }, textContent: '' }));
  const list = { querySelectorAll: () => values };
  const locationButton = eventTarget();
  const locationStatus = { textContent: '' };
  const translations = {
    'ui.browserValueUnavailable': 'Unavailable',
    'ui.browserTouchCapable': 'Touch-capable',
    'ui.browserPointerIdle': 'Move the pointer',
    'ui.browserCoordinates': '{latitude} · {longitude} ±{accuracy}',
  };
  const panel = createBrowserInfoPanel({
    list,
    locationButton,
    locationStatus,
    navigatorRef: browserNavigator,
    screenRef: { width: 800, height: 600 },
    windowRef: browserWindow,
    translate: (key, variables = {}) => Object.entries(variables).reduce((text, [name, value]) => text.replace(`{${name}}`, value), translations[key] || key),
  });
  const value = (name) => values.find((field) => field.dataset.browserInfo === name).textContent;

  assert.equal(browserNavigator.geolocation.calls, 0, 'opening the diagnostics component does not request location');
  assert.equal(browserWindow.listenerCount(), 0, 'pointer and resize listeners stay dormant until the tab is active');
  panel.activate();
  assert.equal(browserWindow.listenerCount(), 4);
  browserWindow.dispatch('pointermove', { clientX: 12.4, clientY: 50.7 });
  assert.equal(browserWindow.frames.length, 1, 'pointer rendering is coalesced to one animation frame');
  browserWindow.frames[0]();
  assert.equal(value('pointer'), '12, 51');

  locationButton.dispatch('click');
  assert.equal(browserNavigator.geolocation.calls, 1, 'location requires the explicit button action');
  assert.equal(locationStatus.textContent, '12.3457 · -45.6789 ±9');
  panel.deactivate();
  assert.equal(browserWindow.listenerCount(), 0, 'leaving the tab releases all live browser listeners');
  panel.activate();
  panel.destroy();
  assert.equal(browserWindow.listenerCount(), 0);
  assert.equal(locationButton.listenerCount(), 0, 'destroy releases the location control listener');
});

test('checkbox rows toggle their whitespace through one delegated listener', () => {
  const root = eventTarget();
  const checkbox = {
    checked: false,
    disabled: false,
    changes: 0,
    dispatchEvent(event) {
      assert.equal(event.type, 'change');
      assert.equal(event.bubbles, true);
      this.changes += 1;
    },
  };
  const row = { querySelector: () => checkbox };
  const rowTarget = {
    closest(selector) {
      return selector === '.checkbox-row, .menu-checkbox' ? row : null;
    },
  };
  const labelTarget = {
    closest(selector) {
      if (selector === '.checkbox-row, .menu-checkbox') return row;
      if (selector === 'input, label, button, a, select, textarea') return {};
      return null;
    },
  };
  const controller = createCheckboxRowController({ root });
  controller.bind();
  controller.bind();
  assert.equal(root.listenerCount(), 1);
  root.dispatch('click', { target: rowTarget });
  assert.equal(checkbox.checked, true);
  root.dispatch('click', { target: labelTarget });
  assert.equal(checkbox.checked, true, 'native input/label clicks are not double-toggled');
  checkbox.disabled = true;
  root.dispatch('click', { target: rowTarget });
  assert.equal(checkbox.checked, true, 'disabled checkboxes ignore row whitespace');
  assert.equal(checkbox.changes, 1);
  controller.destroy();
  controller.destroy();
  assert.equal(root.listenerCount(), 0);
});

test('clicking a menu checkbox keeps its action menu open', () => {
  const root = eventTarget();
  const classes = new Set(['open']);
  const menuItems = { style: { removeProperty() {} }, dataset: {} };
  const menu = {
    dataset: {},
    classList: {
      contains: (name) => classes.has(name),
      remove: (name) => classes.delete(name),
    },
    querySelector: (selector) => selector === '.action-menu-items' ? menuItems : null,
  };
  root.querySelectorAll = (selector) => selector === '.action-menu.open' && classes.has('open') ? [menu] : [];
  const controller = createActionMenuController({ root });
  controller.bind();

  root.dispatch('click', { target: { closest: closestInList('.action-menu-items .menu-checkbox') } });
  assert.equal(classes.has('open'), true, 'a menu checkbox row keeps its menu open');
  root.dispatch('click', { target: { closest: closestInList('.action-menu-items.menu-stay-open') } });
  assert.equal(classes.has('open'), true, 'a stay-open panel keeps its menu open');
  root.dispatch('click', { target: { closest: () => null } });
  assert.equal(classes.has('open'), false, 'an outside click still closes the menu');
  controller.destroy();
});

test('emoji picker renders many choices with one delegated, disposable listener', (t) => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: () => ({
      dataset: {},
      classList: { add() {}, toggle() {} },
      setAttribute() {},
    }),
  };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });

  const container = eventTarget();
  let children = [];
  Object.defineProperty(container, 'innerHTML', {
    set: () => { children = []; },
    get: () => '',
  });
  container.appendChild = (button) => children.push(button);
  container.querySelectorAll = () => children;
  container.contains = (button) => children.includes(button);

  let firstPick = 0;
  let secondPick = 0;
  renderEmojiGrid({ container, onPick: () => { firstPick += 1; } });
  const dispose = renderEmojiGrid({ container, onPick: () => { secondPick += 1; } });
  assert.ok(EMOJI_CATALOG.length > 80);
  assert.equal(children.length, EMOJI_CATALOG.length);
  assert.equal(container.listenerCount(), 1);
  const button = children[1];
  container.dispatch('click', {
    target: { closest: (selector) => selector === '.shape-emoji-btn' ? button : null },
    stopPropagation() {},
  });
  assert.equal(firstPick, 0);
  assert.equal(secondPick, 1);
  dispose();
  assert.equal(container.listenerCount(), 0);
});

test('picking an emoji then another shape clears the emoji-picker highlight', (t) => {
  const store = new Map();
  const storageStub = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
  };
  const previousStorage = globalThis.localStorage;
  const previousDocument = globalThis.document;
  const restore = (name, previous) => {
    try {
      globalThis[name] = previous;
    } catch {
      Object.defineProperty(globalThis, name, { value: previous, configurable: true, writable: true });
    }
  };
  try {
    globalThis.localStorage = storageStub;
  } catch {
    Object.defineProperty(globalThis, 'localStorage', { value: storageStub, configurable: true, writable: true });
  }

  // A button stub with real class/attribute bookkeeping, unlike the render-only
  // stub above, because this test asserts the highlighted state itself.
  const makeButton = () => {
    const classes = new Set();
    const attributes = new Map();
    return {
      textContent: '',
      title: '',
      dataset: {},
      classList: {
        contains: (name) => classes.has(name),
        toggle: (name, force) => {
          const on = force === undefined ? !classes.has(name) : force === true;
          if (on) classes.add(name); else classes.delete(name);
          return on;
        },
      },
      setAttribute: (name, value) => attributes.set(name, value),
      getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
    };
  };
  globalThis.document = { createElement: () => makeButton() };
  t.after(() => {
    restore('localStorage', previousStorage);
    restore('document', previousDocument);
  });

  const container = eventTarget();
  let children = [];
  Object.defineProperty(container, 'innerHTML', { set: () => { children = []; }, get: () => '' });
  container.appendChild = (button) => { children.push(button); };
  container.querySelectorAll = () => children;
  container.contains = (button) => children.includes(button);

  let picked = null;
  renderEmojiGrid({ container, onPick: (emoji) => { picked = emoji; } });
  // The grid never selects on its own; the toolbar owns the highlight.
  assert.equal(children.some((child) => child.classList.contains('active')), false);

  // 1. Pick an emoji: it becomes the one highlighted choice.
  const emojiTile = children[2];
  container.dispatch('click', {
    target: { closest: (selector) => selector === '.shape-emoji-btn' ? emojiTile : null },
    stopPropagation() {},
  });
  assert.equal(picked, emojiTile.textContent);
  assert.equal(emojiTile.classList.contains('active'), true);
  assert.equal(emojiTile.getAttribute('aria-selected'), 'true');

  // 2. Choosing a non-emoji shape clears the picker highlight, so the gallery
  //    cannot show the emoji and another tile as selected at the same time.
  syncEmojiSelection(container, { active: false });
  assert.equal(emojiTile.classList.contains('active'), false);
  assert.equal(emojiTile.getAttribute('aria-selected'), 'false');

  // 3. Returning to the emoji shape restores exactly the last-picked emoji.
  syncEmojiSelection(container, { active: true });
  assert.equal(children.filter((child) => child.classList.contains('active')).length, 1);
  assert.equal(emojiTile.classList.contains('active'), true);
  assert.equal(children[0].classList.contains('active'), false);
});
