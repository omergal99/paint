// js/app/settingsRegistry.js
// Settings reset registry: which storage keys "Reset all settings" owns and
// which handlers restore their area. Phase 3 modularisation — the registry
// definitions live here so main.js only wires the collaborators.
import { createSettingsRegistry } from '../settings/SettingsRegistry.js';
import { STORAGE_KEYS } from '../core/constants.js';

/**
 * @param {object} deps areas that own their own reset behaviour
 * @returns the registry instance used by the Settings dialog
 */
export const createPaintSettingsRegistry = ({ colorPalette, sidebar }) => {
  const registry = createSettingsRegistry();
  registry.registerStorageKey(STORAGE_KEYS.textHistory);
  registry.registerStorageKey(STORAGE_KEYS.settingsTab);
  registry.registerResetHandler(() => colorPalette.resetToDefaults());
  registry.registerResetHandler(() => sidebar.resetSettings());
  return registry;
};