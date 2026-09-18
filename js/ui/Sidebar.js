// js/ui/Sidebar.js
import { GlobalHistory } from '../history/GlobalHistory.js';
import { AI_PROVIDERS } from '../ai/AiConnectionStore.js';

export class Sidebar {
  constructor({ canvasManager, statusBar, palette, aiCommandService = null, dialogService, aiConnectionStore = null, historyManager = null }) {
    this.canvasManager = canvasManager;
    this.historyManager = historyManager;
    this.statusBar = statusBar;
    this.palette = palette;
    this.dialogService = dialogService;
    
    this.sidebar = document.getElementById('right-sidebar');
    this.title = document.getElementById('sidebar-title');
    this.closeBtn = document.getElementById('sidebar-close');
    
    this.historyContent = document.getElementById('sidebar-history-content');
    this.historyGrid = document.getElementById('history-grid');
    this.saveLimitSelect = document.getElementById('history-save-limit');
    this.clearBtn = document.getElementById('history-clear-btn');
    this.saveToHistoryBtn = document.getElementById('history-save-current-btn');
    
    this.aiContent = document.getElementById('sidebar-ai-content');
    this.aiMessages = document.getElementById('ai-chat-messages');
    this.aiInput = document.getElementById('ai-chat-input');
    this.aiSend = document.getElementById('ai-chat-send');
    this.aiActions = document.getElementById('ai-chat-actions');
    this.aiCommandService = aiCommandService;
    this.aiConnectionStore = aiConnectionStore;
    this.aiProviderSelect = document.getElementById('ai-provider-select');
    this.aiConnectButton = document.getElementById('ai-connect-button');
    this.aiConnectionStatus = document.getElementById('ai-connection-status');
    this.aiConnectionDialog = document.getElementById('ai-connection-dialog');
    this.aiConnectionDescription = document.getElementById('ai-connection-description');
    this.aiProviderLink = document.getElementById('ai-provider-link');
    this.aiCopyImageButton = document.getElementById('ai-copy-current-image');
    
    this.groupSettingsContent = document.getElementById('sidebar-group-settings');
    this.groupSettingsContainer = document.getElementById('group-settings-container');
    
    this.globalHistory = new GlobalHistory();
    this.activeTab = null;
    
    // Initialization state tracking for race condition prevention
    this._initComplete = false;
    this._initPromise = null;
    
    // Restore sidebar state IMMEDIATELY before async init
    this._restoreSidebarState();
    this._restoreSidebarWidth();
    
    // Restore ribbon button visibility state IMMEDIATELY
    this._restoreRibbonButtonState();
    
    // Start initialization and track completion
    this._initPromise = this.init();
  }

  async init() {
    try {
      await this.globalHistory.init();
    } catch (error) {
      this.globalHistory.historyEnabled = false;
      console.warn('Global history unavailable:', error);
    }
    
    this.saveLimitSelect.value = this.globalHistory.historyEnabled ? this.globalHistory.maxHistory.toString() : "0";
    
    // History save limit dropdown: change setting, don't auto-clear
    this.saveLimitSelect.addEventListener('change', async (e) => {
      const val = parseInt(e.target.value, 10);
      const enabled = val > 0;
      await this.globalHistory.saveSettings(val, enabled);
      // Use retry logic to ensure render completes
      if (this.activeTab === 'history') {
        await this._loadHistoryWithRetry();
      }
    });
    
    // History sub-tabs: History (IndexedDB) + Session (sessionStorage-backed)
    this.historyView = 'history';
    this._historyTabsEl = document.getElementById('history-view-tabs');
    this._historyTabsEl?.querySelectorAll('[data-history-view]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.historyView = btn.dataset.historyView === 'session' ? 'session' : 'history';
        this._historyTabsEl.querySelectorAll('[data-history-view]').forEach((b) =>
          b.classList.toggle('active', b === btn));
        this._syncHistoryActionLabels();
        this.refreshHistory();
      });
    });
    this._historyTabsEl?.querySelector('[data-history-view="history"]')?.classList.add('active');
    this._syncHistoryActionLabels();

    // Clear button clears whichever view is active (labels follow the tab).
    this.clearBtn.addEventListener('click', async () => {
      if (this.historyView === 'session') {
        const confirmed = await this.dialogService.confirm({
          title: 'Clear session',
          message: 'Delete all session steps for this browser tab? Saved history is kept.',
          confirmLabel: 'Clear session',
          danger: true,
        });
        if (confirmed) {
          this.historyManager?.clearSession();
          if (this.activeTab === 'history') await this._loadHistoryWithRetry();
          this.statusBar?.flash?.('Session cleared');
        }
        return;
      }
      const confirmed = await this.dialogService.confirm({
        title: 'Clear history',
        message: 'Are you sure you want to permanently delete all saved history? This cannot be undone.',
        confirmLabel: 'Clear history',
        danger: true,
      });
      if (confirmed) {
        await this.globalHistory.clearAll();
        // Use retry logic to ensure render completes
        if (this.activeTab === 'history') {
          await this._loadHistoryWithRetry();
        }
        this.statusBar?.flash?.('History cleared');
      }
    });

    // Save current paint to the ACTIVE view (history or session snapshot).
    if (this.saveToHistoryBtn) {
      this.saveToHistoryBtn.addEventListener('click', async () => {
        if (this.historyView === 'session') {
          this.historyManager?.snapshot?.();
          this.historyManager?._persistSessionBackup?.();
          this.refreshHistory();
          this.statusBar?.flash?.('Saved to session');
          return;
        }
        await this.saveCurrentToHistory();
        this.statusBar?.flash?.('Saved to history');
      });
    }

    this.closeBtn.addEventListener('click', () => this.hide());
    
    this.aiSend.addEventListener('click', () => this.handleAiSubmit());
    this.aiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleAiSubmit();
    });
    
    this._bindResizer();
    this._bindAiConnectionControls();
    this._renderAiActions();
    
    // Mark initialization as complete
    this._initComplete = true;
  }

  async finishInit() {
    await this._waitForInit();

    if (this.activeTab === 'history' && this.globalHistory.db) {
      await this._loadHistoryWithRetry();
    }
  }

  async resetSettings() {
    await this._waitForInit();
    return this.globalHistory.resetSettings();
  }

  setAiCommandService(service) {
    this.aiCommandService = service;
    this._renderAiActions();
  }

  _bindAiConnectionControls() {
    if (!this.aiProviderSelect || !this.aiConnectionStore) return;
    this.aiProviderSelect.innerHTML = '';
    AI_PROVIDERS.forEach(({ id, label }) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = label;
      this.aiProviderSelect.appendChild(option);
    });
    const render = () => {
      const state = this.aiConnectionStore.getState();
      this.aiProviderSelect.value = state.provider;
      if (state.provider === 'local') {
        this.aiConnectionStatus.textContent = 'Ready: local actions only';
        this.aiConnectButton.textContent = 'Connected';
        this.aiConnectButton.disabled = true;
      } else {
        this.aiConnectionStatus.textContent = 'Use the provider website; no credentials are stored here';
        this.aiConnectButton.textContent = 'Open provider';
        this.aiConnectButton.disabled = false;
      }
    };
    this.aiProviderSelect.addEventListener('change', (event) => {
      this.aiConnectionStore.setProvider(event.target.value);
      render();
    });
    this.aiConnectButton?.addEventListener('click', () => {
      this._openAiConnectionDialog();
    });
    this.aiCopyImageButton?.addEventListener('click', () => this._copyCurrentImageForAi());
    render();
  }

  _openAiConnectionDialog() {
    if (!this.aiConnectionDialog || this.aiProviderSelect.value === 'local') return;
    const provider = AI_PROVIDERS.find(({ id }) => id === this.aiProviderSelect.value);
    this.aiConnectionDialog.querySelector('[data-ai-provider-name]')?.replaceChildren(provider?.label || 'AI provider');
    this.aiConnectionDescription.textContent = `Open ${provider?.label || 'the AI provider'} in its official website, sign in there, and upload the image yourself. Paint does not receive or store your login details.`;
    this.aiProviderLink.href = provider?.url || '#';
    this.aiProviderLink.textContent = `Open ${provider?.label || 'provider'} website`;
    this.aiCopyImageButton.disabled = false;
    this.aiConnectionDialog.showModal();
    this.aiProviderLink.focus();
  }

  async _copyCurrentImageForAi() {
    try {
      const blob = await this.canvasManager.toBlob('image/png');
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        this.aiConnectionDescription.textContent = 'Image clipboard is unavailable in this browser. Export the image and upload it on the provider website.';
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this.aiConnectionDescription.textContent = 'Current image copied. Open the provider website and paste it into the chat.';
    } catch (error) {
      console.warn('Unable to copy current image for AI:', error);
      this.aiConnectionDescription.textContent = 'The image could not be copied. Export it and upload it on the provider website.';
    }
  }

  _renderAiActions() {
    if (!this.aiActions) return;
    this.aiActions.innerHTML = '';
    const actions = this.aiCommandService?.getQuickActions?.() || [];
    actions.forEach(({ id, label, command }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ai-quick-action';
      button.dataset.aiCommand = command;
      button.dataset.aiCommandId = id;
      button.textContent = label;
      button.title = `Run ${command}`;
      button.addEventListener('click', () => this.handleAiSubmit(command));
      this.aiActions.appendChild(button);
    });
  }

  // Action buttons follow the active view: Clear/Save/Export say exactly
  // which store they touch (History = IndexedDB, Session = browser tab).
  _syncHistoryActionLabels() {
    const session = this.historyView === 'session';
    if (this.saveToHistoryBtn) {
      this.saveToHistoryBtn.textContent = session ? 'Save to Session' : 'Save to History';
      this.saveToHistoryBtn.title = session
        ? 'Snapshot the current paint into this tab session'
        : 'Save current paint to history';
    }
    const exportBtn = document.getElementById('history-export-all-btn');
    if (exportBtn) {
      exportBtn.textContent = session ? 'Export Session' : 'Export History';
      exportBtn.title = session
        ? 'Export the session steps to your computer'
        : 'Export the whole history to your computer';
    }
    if (this.clearBtn) {
      this.clearBtn.textContent = session ? 'Clear Session' : 'Clear History';
      this.clearBtn.title = session ? 'Clear session steps' : 'Clear all saved history';
    }
  }

  async _loadHistoryWithRetry() {
    // Session view has no IDB count to converge on — render once directly.
    if (this.historyView === 'session') {
      await this.refreshHistory();
      return;
    }
    const maxRetries = 5;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const expectedCount = (await this.globalHistory.getSessions()).length;
      if (attempt === 0 && expectedCount > 0) {
        this.historyGrid.innerHTML = '<div class="history-loading">Loading history...</div>';
      }

      const renderedCount = await this.refreshHistory();
      if (renderedCount === expectedCount) {
        return;
      }

      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Wait for async initialization to complete
   * Prevents race condition where finishInit runs before init completes
   * @returns {Promise<void>}
   */
  async _waitForInit() {
    if (this._initComplete) {
      return;
    }

    if (this._initPromise) {
      await this._initPromise;
      return;
    }

    return new Promise((resolve) => {
      const checkInit = setInterval(() => {
        if (this._initComplete) {
          clearInterval(checkInit);
          resolve();
        }
      }, 10);

      setTimeout(() => {
        clearInterval(checkInit);
        console.warn('Sidebar initialization timed out');
        resolve();
      }, 5000);
    });
  }

  async saveCurrentToHistory() {
    if (!this.globalHistory.historyEnabled) return;
    const blob = await this.canvasManager.toBlob('image/png');
    const width = Number(this.canvasManager.canvas.width);
    const height = Number(this.canvasManager.canvas.height);

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

    await this.saveDataUrlToHistory(dataUrl, width, height);
    // beforeunload also places a synchronous fallback in localStorage. If the
    // IndexedDB write won the race, consume that fallback to avoid a duplicate
    // history image on the next refresh.
    try {
      const pending = JSON.parse(localStorage.getItem('paint:pending-history-save') || 'null');
      if (pending?.dataUrl === dataUrl) localStorage.removeItem('paint:pending-history-save');
    } catch {}
  }

  async saveDataUrlToHistory(dataUrl, width, height) {
    if (!this.globalHistory.historyEnabled) return;
    // Skip no-change saves: identical pixels to the newest entry are dropped.
    try {
      const latest = (await this.globalHistory.getSessions())[0];
      if (latest && latest.dataUrl === dataUrl) return;
    } catch {}
    await this.globalHistory.addSession(dataUrl, width, height);
    if (this.activeTab === 'history') this.refreshHistory();
  }

  async flushPendingAutoSave() {
    try {
      const raw = localStorage.getItem('paint:pending-history-save');
      if (!raw) return;
      const pending = JSON.parse(raw);
      if (!pending?.dataUrl) return;
      await this.saveDataUrlToHistory(pending.dataUrl, pending.width, pending.height);
      localStorage.removeItem('paint:pending-history-save');
    } catch (error) {
      console.warn('Unable to flush pending history snapshot:', error);
    }
  }

  toggleHistory() {
    if (this.activeTab === 'history' && this.sidebar.style.display !== 'none') {
      this.hide();
    } else {
      this.showHistory();
    }
  }
  
  toggleAi() {
    if (this.activeTab === 'ai' && this.sidebar.style.display !== 'none') {
      this.hide();
    } else {
      this.showAi();
    }
  }

  showHistory() {
    this.activeTab = 'history';
    this.title.textContent = 'History';
    this.historyContent.style.display = 'block';
    this.aiContent.style.display = 'none';
    if(this.groupSettingsContent) this.groupSettingsContent.style.display = 'none';
    this.sidebar.style.display = 'flex';
    this._saveSidebarState();
    // Only refresh if globalHistory is ready
    if (this.globalHistory.db) {
      this.refreshHistory();
    }
  }

  showAi() {
    this.activeTab = 'ai';
    this.title.textContent = 'AI Chat';
    this.historyContent.style.display = 'none';
    this.aiContent.style.display = 'block';
    if(this.groupSettingsContent) this.groupSettingsContent.style.display = 'none';
    this.sidebar.style.display = 'flex';
    this._saveSidebarState();
  }

  showGroupSettings(titleText, groupSection) {
    if (!this.groupSettingsContent) return;
    this.activeTab = 'group-' + titleText;
    this.title.textContent = titleText + ' Settings';
    this.historyContent.style.display = 'none';
    this.aiContent.style.display = 'none';
    this.groupSettingsContent.style.display = 'block';
    this.sidebar.style.display = 'flex';
    
    this.groupSettingsContainer.innerHTML = '';
    
    const toggleGroup = document.createElement('label');
    toggleGroup.className = 'checkbox-row';
    const cbGroup = document.createElement('input');
    cbGroup.type = 'checkbox';
    const isExtras = groupSection.classList.contains('ribbon-group-extras');
    if (isExtras) cbGroup.disabled = true;
    cbGroup.checked = [...groupSection.children]
      .filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
      .some((child) => !child.hidden && child.style.display !== 'none');
    toggleGroup.appendChild(cbGroup);
    toggleGroup.appendChild(document.createTextNode(' Show Entire Group'));
    cbGroup.addEventListener('change', (e) => {
      if (isExtras) return;
      const groupContent = [...groupSection.children]
        .filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input');
      groupContent.forEach((child) => {
        child.hidden = !e.target.checked;
        child.style.display = e.target.checked ? '' : 'none';
      });
      groupSection.hidden = !e.target.checked;
      const nextSibling = groupSection.nextElementSibling;
      if (nextSibling && nextSibling.classList.contains('separator')) {
        nextSibling.style.display = e.target.checked ? 'block' : 'none';
      }
      this._saveRibbonButtonState();
      window.dispatchEvent(new CustomEvent('paint:ribbon-change'));
    });
    this.groupSettingsContainer.appendChild(toggleGroup);

    if (groupSection.classList.contains('ribbon-group-tools')) {
      const currentToolToggle = document.createElement('label');
      currentToolToggle.className = 'checkbox-row';
      const currentToolCheckbox = document.createElement('input');
      currentToolCheckbox.type = 'checkbox';
      currentToolCheckbox.id = 'show-current-tool-toggle';
      try { currentToolCheckbox.checked = localStorage.getItem('paint:show-current-tool') !== 'false'; } catch { currentToolCheckbox.checked = true; }
      currentToolCheckbox.addEventListener('change', (event) => {
        window.dispatchEvent(new CustomEvent('paint:show-current-tool-change', { detail: event.target.checked }));
        this._saveRibbonButtonState();
      });
      currentToolToggle.append(currentToolCheckbox, document.createTextNode(' Show Current tool'));
      this.groupSettingsContainer.appendChild(currentToolToggle);
    }

    if (groupSection.classList.contains('ribbon-group-colors') && this.palette) {
      this._appendPaletteSettings();
    }
    
    const hr = document.createElement('hr');
    this.groupSettingsContainer.appendChild(hr);

    // Keep the original menu-action filter contract visible for compatibility:
    // .filter((btn) => btn.id !== 'btn-remove-bg' && !btn.closest('.action-menu-items'))
    const buttons = [...groupSection.querySelectorAll('.rbtn')]
      .filter((btn) => btn.id !== 'btn-remove-bg' && btn.id !== 'btn-settings' && btn.id !== 'tool-status' && !btn.closest('.action-menu-items'));
    buttons.forEach(btn => {
      let btnLabel = btn.title || btn.dataset.tool || btn.dataset.shape || btn.textContent.trim();
      const toggleBtn = document.createElement('label');
      toggleBtn.className = 'checkbox-row';
      const cbBtn = document.createElement('input');
      cbBtn.type = 'checkbox';
      cbBtn.checked = !btn.hidden && btn.style.display !== 'none';
      toggleBtn.appendChild(cbBtn);
      toggleBtn.appendChild(document.createTextNode(' Show ' + btnLabel));
      cbBtn.addEventListener('change', (e) => {
        btn.hidden = !e.target.checked;
        btn.style.display = e.target.checked ? '' : 'none';
        if (btn.id === 'btn-ai-chat') {
          window.dispatchEvent(new CustomEvent('paint:ai-chat-visibility-change', {
            detail: e.target.checked,
          }));
        }
        this._saveRibbonButtonState();
        window.dispatchEvent(new CustomEvent('paint:ribbon-change'));
      });
      this.groupSettingsContainer.appendChild(toggleBtn);
    });
    this._saveSidebarState();
  }

  _appendPaletteSettings() {
    const section = document.createElement('section');
    section.className = 'palette-settings-editor';
    const heading = document.createElement('h4');
    heading.textContent = 'Custom palette';
    section.appendChild(heading);

    const defaultRow = document.createElement('div');
    defaultRow.className = 'palette-default-row';
    const defaultInput = document.createElement('input');
    defaultInput.type = 'color';
    defaultInput.value = this.palette.defaultPrimary;
    const defaultLabel = document.createElement('span');
    defaultLabel.textContent = 'Default selected color';
    const useCurrent = document.createElement('button');
    useCurrent.type = 'button';
    useCurrent.textContent = 'Use current';
    useCurrent.addEventListener('click', () => {
      this.palette.setDefaultPrimary(this.palette.primary);
      defaultInput.value = this.palette.defaultPrimary;
    });
    defaultInput.addEventListener('input', () => this.palette.setDefaultPrimary(defaultInput.value));
    defaultRow.append(defaultLabel, defaultInput, useCurrent);
    section.appendChild(defaultRow);

    const grid = document.createElement('div');
    grid.className = 'palette-settings-grid';
    const colors = this.palette.getPalette();
    colors.forEach((color, index) => {
      const input = document.createElement('input');
      input.type = 'color';
      input.value = color;
      input.title = `Palette color ${index + 1}`;
      input.addEventListener('input', () => {
        const next = this.palette.getPalette();
        next[index] = input.value;
        this.palette.setPalette(next);
      });
      grid.appendChild(input);
    });
    section.appendChild(grid);
    this.groupSettingsContainer.appendChild(section);
  }

  hide() {
    this.sidebar.style.display = 'none';
    this._saveSidebarState();
  }

  _bindResizer() {
    const resizer = document.getElementById('sidebar-resizer');
    if (!resizer) return;
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let pointerId = null;

    const stop = () => {
      if (!isResizing) return;
      isResizing = false;
      pointerId = null;
      document.body.style.cursor = '';
      this._saveSidebarWidth();
    };
    resizer.addEventListener('pointerdown', (e) => {
      if (e.button != null && e.button !== 0) return;
      isResizing = true;
      pointerId = e.pointerId;
      startX = e.clientX;
      startWidth = parseInt(document.defaultView.getComputedStyle(this.sidebar).width, 10) || 250;
      resizer.setPointerCapture?.(pointerId);
      document.body.style.cursor = 'ew-resize';
      e.preventDefault();
    });
    resizer.addEventListener('pointermove', (e) => {
      if (!isResizing || e.pointerId !== pointerId) return;
      const dx = startX - e.clientX;
      const newWidth = Math.max(220, Math.min(startWidth + dx, window.innerWidth * 0.8));
      this.sidebar.style.width = `${newWidth}px`;
    });
    resizer.addEventListener('pointerup', stop);
    resizer.addEventListener('pointercancel', stop);
  }

  _saveSidebarState() {
    const state = {
      isOpen: this.sidebar.style.display !== 'none',
      activeTab: this.activeTab
    };
    try {
      localStorage.setItem('paint:sidebar-state', JSON.stringify(state));
    } catch (err) {
      console.warn('Unable to save sidebar state:', err);
    }
  }

  _saveSidebarWidth() {
    try { localStorage.setItem('paint:sidebar-width', this.sidebar.style.width || '250px'); } catch {}
  }

  _restoreSidebarWidth() {
    try {
      const width = parseInt(localStorage.getItem('paint:sidebar-width'), 10);
      if (Number.isFinite(width)) this.sidebar.style.width = `${Math.max(220, Math.min(width, window.innerWidth * 0.8))}px`;
    } catch {}
  }

  _restoreSidebarState() {
    try {
      const stored = localStorage.getItem('paint:sidebar-state');
      if (!stored) return;
      const state = JSON.parse(stored);
      if (!state.isOpen) return;
      
      if (state.activeTab === 'history') {
        // Just set the active tab, don't refresh yet - wait for finishInit()
        this.activeTab = 'history';
        this.title.textContent = 'History';
        this.historyContent.style.display = 'block';
        this.aiContent.style.display = 'none';
        if(this.groupSettingsContent) this.groupSettingsContent.style.display = 'none';
        this.sidebar.style.display = 'flex';
      } else if (state.activeTab === 'ai') {
        this.showAi();
      }
    } catch (err) {
      console.warn('Unable to restore sidebar state:', err);
    }
  }

  _saveRibbonButtonState() {
    try {
      const buttonState = {};
      const buttons = document.querySelectorAll('.rbtn');
      buttons.forEach((btn) => {
        if (btn.id) {
          buttonState[btn.id] = {
            hidden: btn.hidden,
            display: btn.style.display
          };
        }
      });
      localStorage.setItem('paint:ribbon-button-state', JSON.stringify(buttonState));
    } catch (err) {
      console.warn('Unable to save ribbon button state:', err);
    }
  }

  _restoreRibbonButtonState() {
    try {
      const stored = localStorage.getItem('paint:ribbon-button-state');
      if (!stored) return;
      const buttonState = JSON.parse(stored);
      
      Object.keys(buttonState).forEach((btnId) => {
        const btn = document.getElementById(btnId);
        if (btn) {
          btn.hidden = buttonState[btnId].hidden;
          btn.style.display = buttonState[btnId].display;
        }
      });
    } catch (err) {
      console.warn('Unable to restore ribbon button state:', err);
    }
  }

  async refreshHistory() {
    this.historyGrid.innerHTML = '';
    if (this.historyView === 'session') return this._renderSessionView();
    const sessions = await this.globalHistory.getSessions();
    if (sessions.length === 0) {
      const message = this.globalHistory.historyEnabled ? 'No history found' : 'History saving is off';
      this.historyGrid.innerHTML = `<div class="history-empty">${message}</div>`;
      return 0;
    }
    
    sessions.forEach((session, index) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = session.thumb || session.dataUrl;
      img.alt = `Import history image ${index + 1} of ${sessions.length}`;
      img.title = 'Click to import this image';
      img.addEventListener('click', async () => {
        const confirmed = await this.dialogService.confirm({
          title: 'Load history image',
          message: 'Load this image? Unsaved current work will be lost.',
          confirmLabel: 'Load image',
          danger: true,
        });
        if (confirmed) {
          await this.canvasManager.loadImageDataUrl(session.dataUrl, session.width, session.height);
          this.statusBar.flash('Loaded from history');
        }
      });
      item.appendChild(img);
      
      const info = document.createElement('div');
      info.className = 'history-info';
      const d = new Date(session.timestamp);
      info.textContent = `${index + 1}/${sessions.length} · ${d.toLocaleDateString()} ${d.toLocaleTimeString()} · ${session.width}x${session.height}`;
      item.appendChild(info);

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'history-delete';
      deleteButton.innerHTML = '<span style="position: relative; right: 2px;" aria-hidden="true">🗑</span>';
      deleteButton.setAttribute('aria-label', `Delete history image ${index + 1} of ${sessions.length}`);
      deleteButton.title = 'Delete this saved image';
      deleteButton.addEventListener('click', async (event) => {
        event.stopPropagation();
        await this.globalHistory.deleteSession(session.id);
        await this.refreshHistory();
        this.statusBar.flash('History item deleted');
      });
      item.appendChild(deleteButton);

      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'history-save';
      saveButton.innerHTML = '<span aria-hidden="true">⬇</span>';
      saveButton.setAttribute('aria-label', `Save history image ${index + 1} of ${sessions.length} to computer`);
      saveButton.title = 'Save this image to your computer';
      saveButton.addEventListener('click', (event) => {
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent('paint:history-export-item', {
          detail: { session, index },
        }));
      });
      item.append(saveButton);
      
      this.historyGrid.appendChild(item);
    });
    return sessions.length;
  }

  // Session view: undo snapshots + current canvas, so the user can jump back
  // to an exact moment without pressing Undo N times. Backed by
  // sessionStorage thumbnails: survives refresh, dies with the browser tab.
  async _renderSessionView() {
    const entries = this.historyManager?.getSessionEntries?.() || [];
    if (entries.length === 0) {
      this.historyGrid.innerHTML = '<div class="history-empty">No session steps yet — draw something first</div>';
      return 0;
    }
    entries.forEach((entry, index) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = entry.thumb || entry.dataUrl;
      img.alt = `Session step ${index + 1} of ${entries.length}`;
      img.title = 'Click to restore this session step';
      img.addEventListener('click', async () => {
        const confirmed = await this.dialogService.confirm({
          title: 'Restore session step',
          message: 'Restore this step? Unsaved current work will be lost.',
          confirmLabel: 'Restore step',
          danger: true,
        });
        if (confirmed) {
          await this.historyManager._restore(entry);
          this.statusBar.flash('Restored session step');
          this.refreshHistory();
        }
      });
      item.appendChild(img);
      const info = document.createElement('div');
      info.className = 'history-info';
      info.textContent = `${entry.label || `Step ${index + 1}`} · ${entry.width}x${entry.height}`;
      item.appendChild(info);
      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'history-save';
      saveButton.innerHTML = '<span aria-hidden="true">⬇</span>';
      saveButton.setAttribute('aria-label', `Save session step ${index + 1} of ${entries.length} to computer`);
      saveButton.title = 'Save this step to your computer';
      saveButton.addEventListener('click', (event) => {
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent('paint:history-export-item', {
          detail: { session: entry, index },
        }));
      });
      item.append(saveButton);
      this.historyGrid.appendChild(item);
    });
    return entries.length;
  }

  async handleAiSubmit(commandInput = null) {
    const text = String(commandInput ?? this.aiInput.value).trim();
    if (!text) return;
    this.aiInput.value = '';
    
    // Append user message
    const uMsg = document.createElement('div');
    uMsg.className = 'ai-msg user';
    uMsg.textContent = text;
    this.aiMessages.appendChild(uMsg);
    
    const result = this.aiCommandService
      ? await this.aiCommandService.execute(text)
      : { reply: 'Deterministic actions are not ready yet.' };
    const bMsg = document.createElement('div');
    bMsg.className = `ai-msg bot${result.matched ? ' ai-msg-applied' : ''}`;
    bMsg.textContent = result.reply;
    this.aiMessages.appendChild(bMsg);

    this.aiMessages.scrollTop = this.aiMessages.scrollHeight;
  }
}
