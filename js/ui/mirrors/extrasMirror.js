// js/ui/mirrors/extrasMirror.js
// Phase 2 step-04 SSOT: Extras ribbon group -> RibbonMirror descriptor.
// The History entries are real deep links now: they open the sidebar History
// panel on the requested view (reusing HistoryPanel.setView) or the Settings
// History tab, and focus returns to the trigger when the sidebar closes.
// The descriptor is a factory because the deep-link callbacks are owned by
// Sidebar; everything else still clicks the ribbon control.
import { t } from '../../i18n/messages.js';

const HISTORY_VIEWS_UI = Object.freeze([
  ['history', 'history.title', 'sidebar-mirror-history-tab'],
  ['session', 'history.session', 'sidebar-mirror-session-tab'],
  ['preferences', null, 'sidebar-mirror-history-preferences'],
]);

const mountHistoryEntries = (host, { openHistoryView, openHistoryPreferences }) => {
  host.dataset.tag = 'sidebar-mirror-history-entries';
  HISTORY_VIEWS_UI.forEach(([view, key, tag]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mirror-action';
    button.dataset.tag = tag;
    // "Preferences" has no History panel view; it opens Settings > History,
    // the same path as the sidebar's read-only "Open" link.
    const label = key ? t(key) : t('ui.historyPreferences');
    button.textContent = label;
    if (key) button.setAttribute('data-i18n-runtime', key);
    else button.setAttribute('data-i18n-runtime', 'ui.historyPreferences');
    button.addEventListener('click', () => {
      if (view === 'preferences') openHistoryPreferences?.(button);
      else openHistoryView?.(view, { trigger: button });
    });
    host.append(button);
  });
};

export const createExtrasMirrorDescriptor = ({ openHistoryView = null, openHistoryPreferences = null } = {}) => Object.freeze({
  key: 'extras',
  titleKey: 'ribbon.groups.extras',
  layout: 'sections',
  visibility: true,
  sections: Object.freeze([
    Object.freeze({
      id: 'extras',
      titleKey: 'ui.extras',
      open: true,
      items: Object.freeze([
        Object.freeze({ kind: 'action', target: 'btn-ai-chat', tag: 'sidebar-mirror-btn-ai-chat' }),
        Object.freeze({ kind: 'action', target: 'btn-settings', tag: 'sidebar-mirror-btn-settings' }),
      ]),
    }),
    Object.freeze({
      id: 'history',
      titleKey: 'history.title',
      open: false,
      items: Object.freeze([
        Object.freeze({
          kind: 'custom',
          mount: (host) => mountHistoryEntries(host, { openHistoryView, openHistoryPreferences }),
        }),
      ]),
    }),
  ]),
});