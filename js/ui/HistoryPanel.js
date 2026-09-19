// Functional History/Session panel seam. Data loading and persistence remain
// with Sidebar; this module owns the panel's view state, tab semantics, and
// action labels so those UI rules do not spread through the history renderer.

export const createHistoryPanel = ({ root = document, onViewChange = () => {} } = {}) => {
  const tabs = [...root.querySelectorAll('[data-history-view]')];
  const actionLabel = root.querySelector('#history-actions-label');
  const saveButton = root.querySelector('#history-save-current-btn');
  const exportButton = root.querySelector('#history-export-all-btn');
  const clearButton = root.querySelector('#history-clear-btn');
  let activeView = 'history';

  const sync = () => {
    const session = activeView === 'session';
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
    activeView = view === 'session' ? 'session' : 'history';
    sync();
    onViewChange(activeView);
  };

  const bind = () => {
    tabs.forEach((tab) => {
      tab.setAttribute('role', 'tab');
      tab.addEventListener('click', () => setView(tab.dataset.historyView));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const index = tabs.indexOf(tab);
        const nextIndex = event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : (index + 1) % tabs.length;
        tabs[nextIndex]?.focus();
        setView(tabs[nextIndex]?.dataset.historyView);
      });
    });
    sync();
  };

  return Object.freeze({
    bind,
    sync,
    setView,
    getView: () => activeView,
  });
};
