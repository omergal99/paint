// js/history/GlobalHistory.js
// Saves sessions across page loads using IndexedDB

const DB_NAME = 'omerpaint_global_history';
const STORE_NAME = 'sessions';
const SETTINGS_STORE = 'settings';

export class GlobalHistory {
  constructor() {
    this.db = null;
    this.maxHistory = 20; // Default
    this.historyEnabled = true;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      };
      
      request.onsuccess = async (e) => {
        this.db = e.target.result;
        await this._loadSettings();
        resolve();
      };
      
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async _loadSettings() {
    return new Promise((resolve) => {
      const tx = this.db.transaction(SETTINGS_STORE, 'readonly');
      const store = tx.objectStore(SETTINGS_STORE);
      const req = store.get('maxHistory');
      req.onsuccess = () => {
        if (req.result !== undefined) {
          this.maxHistory = req.result.value;
        }
        const enabledReq = store.get('historyEnabled');
        enabledReq.onsuccess = () => {
          if (enabledReq.result !== undefined) {
            this.historyEnabled = enabledReq.result.value;
          }
          resolve();
        };
      };
    });
  }

  async saveSettings(maxHistory, enabled) {
    this.maxHistory = maxHistory;
    this.historyEnabled = enabled;
    
    return new Promise((resolve) => {
      const tx = this.db.transaction(SETTINGS_STORE, 'readwrite');
      const store = tx.objectStore(SETTINGS_STORE);
      store.put({ key: 'maxHistory', value: maxHistory });
      store.put({ key: 'historyEnabled', value: enabled });
      tx.oncomplete = () => {
        if (!enabled) {
          resolve();
          return;
        }
        this._enforceLimit().then(resolve);
      };
    });
  }

  async addSession(dataUrl, width, height) {
    if (!this.historyEnabled || !this.db) return;
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const item = {
        timestamp: Date.now(),
        dataUrl,
        width,
        height
      };
      
      const request = store.add(item);
      request.onsuccess = () => {
        this._enforceLimit().then(resolve);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSessions() {
    if (!this.db) return [];
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        // Sort descending by timestamp
        const sessions = request.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(sessions);
      };
    });
  }

  async clearAll() {
    if (!this.db) return;
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
    });
  }

  async deleteSession(id) {
    if (!this.db || id === undefined) return;
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
    });
  }

  async _enforceLimit() {
    if (!this.db) return;
    const sessions = await this.getSessions();
    if (sessions.length <= this.maxHistory) return;
    
    const toDelete = sessions.slice(this.maxHistory);
    
    return new Promise((resolve) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      toDelete.forEach(session => {
        store.delete(session.id);
      });
      tx.oncomplete = () => resolve();
    });
  }
}
