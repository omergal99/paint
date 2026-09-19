// js/history/GlobalHistory.js
// Saves sessions across page loads using IndexedDB.
// v2 adds compressed `thumb` + `docId` fields; v1 entries keep working.

const DB_NAME = 'omerpaint_global_history';
const DB_VERSION = 2;
const STORE_NAME = 'sessions';
const SETTINGS_STORE = 'settings';
export const DEFAULT_HISTORY_LIMIT = 50;
export const DEFAULT_HISTORY_ENABLED = true;
const THUMB_MAX = 160;

export class GlobalHistory {
  constructor() {
    this.db = null;
    this.maxHistory = DEFAULT_HISTORY_LIMIT;
    this.historyEnabled = DEFAULT_HISTORY_ENABLED;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

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

  async resetSettings() {
    if (!this.db) return;
    return this.saveSettings(DEFAULT_HISTORY_LIMIT, DEFAULT_HISTORY_ENABLED);
  }

  async addSession(dataUrl, width, height, { docId = null } = {}) {
    if (!this.historyEnabled || !this.db) return;

    const thumb = await makeThumbnail(dataUrl, width, height).catch(() => null);
    // OOM guard: if storage is >90% full, drop oldest first so this write
    // has room instead of throwing QuotaExceededError at the user.
    await this._ensureQuotaRoom().catch(() => {});

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const item = {
        timestamp: Date.now(),
        dataUrl,
        width,
        height,
        docId,
      };
      if (thumb) item.thumb = thumb;

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

  // Drop oldest entries when the origin quota is nearly full (OOM safety).
  async _ensureQuotaRoom() {
    try {
      const estimate = await navigator.storage?.estimate?.();
      if (!estimate?.quota) return;
      if ((estimate.usage || 0) / estimate.quota < 0.9) return;
      const sessions = await this.getSessions();
      const victims = sessions.slice(-Math.max(1, Math.ceil(sessions.length * 0.2)));
      if (!victims.length) return;
      await new Promise((resolve) => {
        const tx = this.db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        victims.forEach((s) => store.delete(s.id));
        tx.oncomplete = () => resolve();
      });
    } catch {}
  }
}

// Downscaled preview (max 160px, webp q0.6 → jpeg fallback) used by the
// history grid. Full image is kept in `dataUrl` and decoded only on load,
// so this runs once per save, never on the stroke hot path.
export const makeThumbnail = async (dataUrl, width, height) => {
  const bitmap = await createImageBitmapFromDataUrl(dataUrl);
  const scale = Math.min(1, THUMB_MAX / Math.max(1, Math.max(bitmap.width, bitmap.height)));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  for (const type of ['image/webp', 'image/jpeg']) {
    try {
      const url = canvas.toDataURL(type, 0.6);
      if (url && url.length < (dataUrl?.length || Infinity)) return url;
    } catch {}
  }
  return null;
}

const createImageBitmapFromDataUrl = (dataUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (typeof createImageBitmap === 'function') {
        createImageBitmap(img).then(resolve, () => resolve(img));
      } else resolve(img);
    };
    img.onerror = () => reject(new Error('Thumbnail decode failed'));
    img.src = dataUrl;
  });
}
