// js/app/shortcutSettings.js
// The Settings ▸ Shortcuts panel: one row per binding, edited in place and
// persisted through the settings store. Phase 3 modularisation.
import { t } from '../i18n/messages.js';
import { createShortcutManager, formatShortcut, shortcutFromEvent } from '../settings/ShortcutManager.js';
import { SHORTCUT_DEFINITIONS } from '../core/constants.js';

/**
 * @param {object} deps
 * @param {object} deps.settingsStore owner of the persisted `shortcuts` value
 */
export const initShortcutSettings = ({ settingsStore }) => {
  const shortcutManager = createShortcutManager({ bindings: settingsStore.get().shortcuts });
  settingsStore.subscribe((state) => shortcutManager.replace(state.shortcuts));

  const status = document.getElementById('shortcut-settings-status');
  const persist = () => settingsStore.set({ shortcuts: shortcutManager.get() });
  const say = (message) => {
    if (status) status.textContent = message;
  };

  const renderShortcutSettings = () => {
    const host = document.getElementById('shortcut-settings-list');
    if (!host) return;
    host.replaceChildren();
    for (const definition of SHORTCUT_DEFINITIONS) {
      const row = document.createElement('div');
      row.className = 'shortcut-setting-row';
      const label = document.createElement('label');
      label.textContent = definition.label;
      const input = document.createElement('input');
      input.type = 'text';
      input.readOnly = true;
      input.className = 'shortcut-setting-input';
      input.id = `shortcut-${definition.action}`;
      input.dataset.shortcutAction = definition.action;
      input.setAttribute('aria-label', `${definition.label} shortcut`);
      input.value = formatShortcut(shortcutManager.get()[definition.action]);
      input.title = 'Focus this field and press the shortcut you want';
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          input.blur();
          return;
        }
        const next = shortcutFromEvent(event);
        if (!next) return;
        event.preventDefault();
        event.stopPropagation();
        const result = shortcutManager.assign(definition.action, next);
        if (!result.ok) {
          const message = t('ui.shortcutAlreadyAssigned');
          input.setCustomValidity(message);
          say(message);
          return;
        }
        input.setCustomValidity('');
        input.value = formatShortcut(result.value);
        persist();
        say(t('ui.shortcutSaved', { action: definition.label }));
      });
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'settings-link-button shortcut-reset';
      reset.textContent = t('ui.default');
      reset.addEventListener('click', () => {
        const result = shortcutManager.reset(definition.action);
        if (!result.ok) return;
        input.setCustomValidity('');
        input.value = formatShortcut(result.value);
        persist();
        say(t('ui.shortcutReset', { action: definition.label }));
      });
      label.htmlFor = input.id;
      row.append(label, input, reset);
      host.appendChild(row);
    }
  };

  renderShortcutSettings();

  // The rows are built in JS, so a language switch must re-render them; the
  // static-label observer cannot translate nodes this module created.
  document.documentElement?.addEventListener('paint:locale-change', renderShortcutSettings);

  return Object.freeze({ shortcutManager, renderShortcutSettings });
};