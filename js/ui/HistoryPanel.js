// Functional History/Session panel seam. Data loading and persistence remain
// with Sidebar; this module owns the panel's view state, tab semantics, and
// action labels so those UI rules do not spread through the history renderer.

import { HISTORY_VIEWS, KEYBOARD_KEYS } from '../core/constants.js';

export const createHistoryPanel = ({ root = document, onViewChange = () => {} } = {}) => {
  const tabs = [...root.querySelectorAll('[data-history-view]')];
  const actionLabel = root.querySelector('#history-actions-label');
  const saveButton = root.querySelector('#history-save-current-btn');
  const exportButton = root.querySelector('#history-export-all-btn');
  const clearButton = root.querySelector('#history-clear-btn');
  let activeView = HISTORY_VIEWS.history;
  let bound = false;

  const sync = () => {
    const session = activeView === HISTORY_VIEWS.session;
    tabs.forEach((tab) => {
      const selected = tab.dataset.historyView === activeView;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.setAttribute('tabindex', selected ? '0' : '-1');
    });
    if (actionLabel) actionLabel.textContent = session ? 'Actions: Session' : 'Actions: History';
    if (saveButton) {
      saveButton.textContent = 'Save Current';
      saveButton.title = session
        ? 'Snapshot the current paint into this tab session'
        : 'Save current paint to history';
    }
    if (exportButton) {
      exportButton.textContent = 'Export All';
      exportButton.title = session
        ? 'Export the session steps to your computer'
        : 'Export the whole history to your computer';
    }
    if (clearButton) {
      clearButton.textContent = 'Clear All';
      clearButton.title = session ? 'Clear session steps' : 'Clear all saved history';
    }
  };

  const setView = (view) => {
    activeView = view === HISTORY_VIEWS.session ? HISTORY_VIEWS.session : HISTORY_VIEWS.history;
    sync();
    onViewChange(activeView);
  };

  // Phase 2 step-04: deep links (Extras -> History / Session) must move focus
  // into the panel so keyboard users land on the requested tab.
  const focusActiveView = () => {
    const active = tabs.find((tab) => tab.dataset.historyView === activeView) || tabs[0];
    active?.focus?.();
  };

  const getTabFromEvent = (event) => {
    const tab = event.target?.closest?.('[data-history-view]');
    return tab && root.contains(tab) ? tab : null;
  };

  const handleTabClick = (event) => {
    const tab = getTabFromEvent(event);
    if (tab) setView(tab.dataset.historyView);
  };

  const handleTabKeydown = (event) => {
    const tab = getTabFromEvent(event);
    if (!tab || !KEYBOARD_KEYS.horizontalArrows.includes(event.key)) return;
    event.preventDefault();
    const index = tabs.indexOf(tab);
    const nextIndex = event.key === KEYBOARD_KEYS.arrowLeft
      ? (index - 1 + tabs.length) % tabs.length
      : (index + 1) % tabs.length;
    tabs[nextIndex]?.focus();
    setView(tabs[nextIndex]?.dataset.historyView);
  };

  const bind = () => {
    if (bound) return;
    bound = true;
    tabs.forEach((tab) => {
      tab.setAttribute('role', 'tab');
    });
    root.addEventListener('click', handleTabClick);
    root.addEventListener('keydown', handleTabKeydown);
    sync();
  };

  return Object.freeze({
    bind,
    sync,
    setView,
    focusActiveView,
    getView: () => activeView,
    destroy() {
      if (!bound) return;
      bound = false;
      root.removeEventListener('click', handleTabClick);
      root.removeEventListener('keydown', handleTabKeydown);
    },
  });
};
