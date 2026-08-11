const DATABASE_NAME = 'paint-workspace';
const STORE_NAME = 'documents';
const DOCUMENT_KEY = 'last-canvas';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is unavailable'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open IndexedDB'));
  });
}

function requestTransaction(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
  }));
}

export async function saveCanvasState(canvas, metadata = {}) {
  try {
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Canvas encoding failed')), 'image/png');
    });
    await requestTransaction('readwrite', (store) => store.put({
      blob,
      width: canvas.width,
      height: canvas.height,
      updatedAt: Date.now(),
      ...metadata,
    }, DOCUMENT_KEY));
    return true;
  } catch (error) {
    console.warn('Canvas autosave unavailable:', error);
    return false;
  }
}

export async function loadCanvasState() {
  try {
    return await requestTransaction('readonly', (store) => store.get(DOCUMENT_KEY)) || null;
  } catch (error) {
    console.warn('Canvas autosave restore unavailable:', error);
    return null;
  }
}

export async function clearCanvasState() {
  try {
    await requestTransaction('readwrite', (store) => store.delete(DOCUMENT_KEY));
    return true;
  } catch (error) {
    console.warn('Canvas autosave cleanup unavailable:', error);
    return false;
  }
}

export function installCanvasAutosave({ canvas, eventTarget = window, debounceMs = 700 }) {
  let timer = 0;
  const save = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => saveCanvasState(canvas), debounceMs);
  };
  eventTarget.addEventListener('paint:changed', save);
  return () => {
    window.clearTimeout(timer);
    eventTarget.removeEventListener('paint:changed', save);
  };
}
