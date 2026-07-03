// js/ui/Sidebar.js
import { GlobalHistory } from '../history/GlobalHistory.js';

export class Sidebar {
  constructor({ canvasManager, statusBar }) {
    this.canvasManager = canvasManager;
    this.statusBar = statusBar;
    
    this.sidebar = document.getElementById('right-sidebar');
    this.title = document.getElementById('sidebar-title');
    this.closeBtn = document.getElementById('sidebar-close');
    
    this.historyContent = document.getElementById('sidebar-history-content');
    this.historyGrid = document.getElementById('history-grid');
    this.saveLimitSelect = document.getElementById('history-save-limit');
    this.clearBtn = document.getElementById('history-clear-btn');
    
    this.aiContent = document.getElementById('sidebar-ai-content');
    this.aiMessages = document.getElementById('ai-chat-messages');
    this.aiInput = document.getElementById('ai-chat-input');
    this.aiSend = document.getElementById('ai-chat-send');
    
    this.groupSettingsContent = document.getElementById('sidebar-group-settings');
    this.groupSettingsContainer = document.getElementById('group-settings-container');
    
    this.globalHistory = new GlobalHistory();
    this.activeTab = null;
    
    this.init();
  }

  async init() {
    await this.globalHistory.init();
    
    this.saveLimitSelect.value = this.globalHistory.historyEnabled ? this.globalHistory.maxHistory.toString() : "0";
    
    this.saveLimitSelect.addEventListener('change', async (e) => {
      const val = parseInt(e.target.value, 10);
      const enabled = val > 0;
      await this.globalHistory.saveSettings(val, enabled);
      this.refreshHistory();
    });
    
    this.clearBtn.addEventListener('click', async () => {
      if (confirm('Clear all saved history?')) {
        await this.globalHistory.clearAll();
        this.refreshHistory();
      }
    });

    this.closeBtn.addEventListener('click', () => this.hide());
    
    this.aiSend.addEventListener('click', () => this.handleAiSubmit());
    this.aiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleAiSubmit();
    });
    
    this._bindResizer();
  }

  async saveCurrentToHistory() {
    if (!this.globalHistory.historyEnabled) return;
    const blob = await this.canvasManager.toBlob('image/png');
    
    // We need dataUrl for IndexedDB
    const reader = new FileReader();
    reader.onload = async () => {
      await this.globalHistory.addSession(reader.result, this.canvasManager.width, this.canvasManager.height);
      if (this.activeTab === 'history') this.refreshHistory();
    };
    reader.readAsDataURL(blob);
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
    this.refreshHistory();
  }

  showAi() {
    this.activeTab = 'ai';
    this.title.textContent = 'AI Chat';
    this.historyContent.style.display = 'none';
    this.aiContent.style.display = 'block';
    if(this.groupSettingsContent) this.groupSettingsContent.style.display = 'none';
    this.sidebar.style.display = 'flex';
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
    cbGroup.checked = groupSection.style.display !== 'none';
    toggleGroup.appendChild(cbGroup);
    toggleGroup.appendChild(document.createTextNode(' Show Entire Group'));
    cbGroup.addEventListener('change', (e) => {
      groupSection.style.display = e.target.checked ? 'flex' : 'none';
      const nextSibling = groupSection.nextElementSibling;
      if (nextSibling && nextSibling.classList.contains('separator')) {
        nextSibling.style.display = e.target.checked ? 'block' : 'none';
      }
    });
    this.groupSettingsContainer.appendChild(toggleGroup);
    
    const hr = document.createElement('hr');
    this.groupSettingsContainer.appendChild(hr);

    const buttons = groupSection.querySelectorAll('.rbtn');
    buttons.forEach(btn => {
      let btnLabel = btn.title || btn.dataset.tool || btn.dataset.shape || btn.textContent.trim();
      const toggleBtn = document.createElement('label');
      toggleBtn.className = 'checkbox-row';
      const cbBtn = document.createElement('input');
      cbBtn.type = 'checkbox';
      cbBtn.checked = btn.style.display !== 'none';
      toggleBtn.appendChild(cbBtn);
      toggleBtn.appendChild(document.createTextNode(' Show ' + btnLabel));
      cbBtn.addEventListener('change', (e) => {
        btn.style.display = e.target.checked ? '' : 'none';
      });
      this.groupSettingsContainer.appendChild(toggleBtn);
    });
  }

  hide() {
    this.sidebar.style.display = 'none';
  }

  _bindResizer() {
    const resizer = document.getElementById('sidebar-resizer');
    if (!resizer) return;
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    resizer.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = parseInt(document.defaultView.getComputedStyle(this.sidebar).width, 10);
      document.body.style.cursor = 'ew-resize';
      e.preventDefault();
    });
    
    window.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const dx = startX - e.clientX;
      const newWidth = Math.max(200, Math.min(startWidth + dx, window.innerWidth * 0.8));
      this.sidebar.style.width = newWidth + 'px';
    });
    
    window.addEventListener('mouseup', () => {
      isResizing = false;
      document.body.style.cursor = '';
    });
  }

  async refreshHistory() {
    this.historyGrid.innerHTML = '';
    if (!this.globalHistory.historyEnabled) {
      this.historyGrid.innerHTML = '<div class="history-empty">History is disabled</div>';
      return;
    }
    const sessions = await this.globalHistory.getSessions();
    if (sessions.length === 0) {
      this.historyGrid.innerHTML = '<div class="history-empty">No history found</div>';
      return;
    }
    
    for (const session of sessions) {
      const item = document.createElement('div');
      item.className = 'history-item';
      
      const img = document.createElement('img');
      img.src = session.dataUrl;
      item.appendChild(img);
      
      const info = document.createElement('div');
      info.className = 'history-info';
      const d = new Date(session.timestamp);
      info.textContent = `${d.toLocaleDateString()} ${d.toLocaleTimeString()} - ${session.width}x${session.height}`;
      item.appendChild(info);
      
      item.addEventListener('click', () => {
        if (confirm('Load this image? Unsaved current work will be lost.')) {
          this.canvasManager.loadImageDataUrl(session.dataUrl, session.width, session.height);
          this.statusBar.flash('Loaded from history');
        }
      });
      
      this.historyGrid.appendChild(item);
    }
  }

  handleAiSubmit() {
    const text = this.aiInput.value.trim();
    if (!text) return;
    this.aiInput.value = '';
    
    // Append user message
    const uMsg = document.createElement('div');
    uMsg.className = 'ai-msg user';
    uMsg.textContent = text;
    this.aiMessages.appendChild(uMsg);
    
    // Mock AI response
    setTimeout(() => {
      const bMsg = document.createElement('div');
      bMsg.className = 'ai-msg bot';
      bMsg.textContent = 'I am a mockup AI. I cannot actually execute: "' + text + '" yet!';
      this.aiMessages.appendChild(bMsg);
      this.aiMessages.scrollTop = this.aiMessages.scrollHeight;
    }, 500);
    
    this.aiMessages.scrollTop = this.aiMessages.scrollHeight;
  }
}
