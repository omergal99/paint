// SettingsRegistry.js
// One reset contract for browser-persisted preferences. Feature modules can
// register a storage key or an async reset handler without making the About
// screen know where that feature stores its state.

export const DEFAULT_SETTING_STORAGE_KEYS = Object.freeze([
  'omerpaint:settings',
  'paint:colors',
  'paint:zoom',
  'paint:initial-zoom',
  'paint:selected-tool',
  'paint:font-size',
  'paint:text-styles',
  'paint:text-style',
  'paint:text-history',
  'paint:text-history-toolbar',
  'paint:storage-estimate',
  'paint:tool-styles',
  'paint:style-history',
  'paint:show-current-tool',
  'paint:color-inspector-collapsed',
  'paint:panel-layout',
  'paint:sidebar-state',
  'paint:sidebar-width',
  'paint:shape-select-after-draw',
  'paint:text-select-after-draw',
  'paint:selected-emoji',
  'paint:selected-shape',
  'paint:ribbon-button-state',
  'paint:pending-history-save',
  'paint:ai-connection',
]);

export const createSettingsRegistry = ({ storage = globalThis.localStorage } = {}) => {
  const storageKeys = new Set(DEFAULT_SETTING_STORAGE_KEYS);
  const resetHandlers = new Set();

  return {
    registerStorageKey(key) {
      if (typeof key === 'string' && key) storageKeys.add(key);
    },

    registerResetHandler(handler) {
      if (typeof handler === 'function') resetHandlers.add(handler);
    },

    async resetAll() {
      for (const key of storageKeys) {
        try {
          storage?.removeItem(key);
        } catch (error) {
          console.warn(`Unable to reset setting: ${key}`, error);
        }
      }

      for (const handler of resetHandlers) {
        try {
          await handler();
        } catch (error) {
          console.warn('Unable to reset a registered setting module', error);
        }
      }
    },
  };
}
