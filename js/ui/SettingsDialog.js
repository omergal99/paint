// Functional settings-dialog seam. It standardizes tab roles, panel
// visibility, focus restoration, and URL-facing change notifications while
// the composition root keeps feature-specific settings persistence.

export const createSettingsDialog = ({
  dialog,
  tabs = [],
  panels = [],
  onChange = () => {},
} = {}) => {
  const tabList = [...tabs];
  const panelList = [...panels];
  let activeTab = tabList.find((tab) => tab.classList.contains('active'))?.dataset.settingsTab || 'general';
  let returnFocus = null;

  const sync = (name = activeTab) => {
    activeTab = tabList.some((tab) => tab.dataset.settingsTab === name) ? name : 'general';
    tabList.forEach((tab) => {
      const selected = tab.dataset.settingsTab === activeTab;
      const panelId = `settings-panel-${tab.dataset.settingsTab}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(selected));
      tab.setAttribute('tabindex', selected ? '0' : '-1');
      tab.setAttribute('aria-controls', panelId);
      tab.classList.toggle('active', selected);
    });
    panelList.forEach((panel) => {
      const panelId = `settings-panel-${panel.dataset.settingsPanel}`;
      if (!panel.id) panel.id = panelId;
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', `settings-tab-${panel.dataset.settingsPanel}`);
      panel.hidden = panel.dataset.settingsPanel !== activeTab;
    });
    tabList.forEach((tab) => {
      if (!tab.id) tab.id = `settings-tab-${tab.dataset.settingsTab}`;
    });
  };

  const setTab = (name) => {
    sync(name);
    onChange(activeTab);
    return activeTab;
  };

  const open = (name = 'general', trigger = document.activeElement) => {
    returnFocus = trigger instanceof HTMLElement ? trigger : null;
    if (!dialog?.open) dialog?.showModal();
    setTab(name);
  };

  const close = () => dialog?.close();

  const bind = () => {
    const tabListEl = tabList[0]?.parentElement;
    tabListEl?.setAttribute('role', 'tablist');
    tabList.forEach((tab) => {
      tab.addEventListener('click', () => setTab(tab.dataset.settingsTab));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const index = tabList.indexOf(tab);
        const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight';
        const nextIndex = forward
          ? (index + 1) % tabList.length
          : (index - 1 + tabList.length) % tabList.length;
        const next = tabList[nextIndex];
        setTab(next.dataset.settingsTab);
        next.focus();
      });
    });
    dialog?.addEventListener('close', () => {
      const focusTarget = returnFocus;
      returnFocus = null;
      focusTarget?.focus?.();
    });
    sync();
  };

  return Object.freeze({ bind, open, close, setTab, sync, getTab: () => activeTab });
};
