import { LIMITS, STORAGE_KEYS } from '../core/constants.js';

const isValidEntry = (entry) => entry
  && typeof entry === 'object'
  && typeof entry.message === 'string'
  && entry.message.length > 0
  && typeof entry.timestamp === 'string'
  && Number.isFinite(Date.parse(entry.timestamp));

export const createStatusHistoryStore = ({
  storage = globalThis.localStorage,
  key = STORAGE_KEYS.statusHistory,
} = {}) => {
  const getEntries = () => {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries) || !entries.every(isValidEntry)) {
      throw new Error('Stored status history is invalid');
    }
    return entries.slice(0, LIMITS.maxStatusHistoryEntries);
  };

  const record = (entry) => {
    if (!isValidEntry(entry)) throw new TypeError('Status history entry is invalid');
    const entries = [entry, ...getEntries()].slice(0, LIMITS.maxStatusHistoryEntries);
    storage.setItem(key, JSON.stringify(entries));
    return entries;
  };

  return Object.freeze({ getEntries, record });
};
