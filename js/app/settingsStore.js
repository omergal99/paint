// js/app/settingsStore.js
// The persisted settings schema: defaults, per-key validators and the store
// factory. Phase 3 modularisation — `main.js` only calls `createSettingsStore()`,
// so the schema has exactly one owner and can grow new keys without touching the
// composition root.
import { createSettingsStore } from '../settings/SettingsStore.js';
import { DEFAULT_SETTINGS, HISTORY_LIMIT_OPTIONS, STORAGE_KEYS } from '../core/constants.js';

/** Validators gate what may be persisted; anything else falls back to the default. */
const SETTINGS_VALIDATORS = Object.freeze({
  canvasBackground: (value) => ['none', 'solid', 'transparent', 'checkerboard', 'grid'].includes(value),
  solidBackgroundColor: (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value),
  defaultZoom: (value) => Number.isFinite(Number(value)) && Number(value) > 0,
  interfaceDirection: (value) => ['auto', 'ltr', 'rtl'].includes(value),
  historyAutoSaveMode: (value) => ['all', 'close', 'lifecycle'].includes(value),
  historyLimit: (value) => HISTORY_LIMIT_OPTIONS.includes(Number(value)),
  favoriteShapes: (value) => Array.isArray(value) && value.every((item) => typeof item === 'string' && item),
});

/**
 * @param {object} [options]
 * @param {Storage} [options.storage] injectable for tests
 * @param {string} [options.key] storage key override
 */
export const createPaintSettingsStore = ({ storage = globalThis.localStorage, key = STORAGE_KEYS.settings } = {}) => createSettingsStore({
  storage,
  key,
  defaults: DEFAULT_SETTINGS,
  validators: SETTINGS_VALIDATORS,
});

export { SETTINGS_VALIDATORS };