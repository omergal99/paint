import { t } from '../i18n/messages.js';

export const createStatusHistoryPanel = ({
  root,
  list,
  error,
  locale = () => undefined,
} = {}) => {
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat(locale() || undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const render = (entries = []) => {
    if (!root || !list) return;
    root.hidden = false;
    list.replaceChildren();
    if (error) {
      error.hidden = true;
      error.textContent = '';
    }
    if (entries.length === 0) {
      const empty = document.createElement('li');
      empty.textContent = t('ui.statusHistoryEmpty');
      list.appendChild(empty);
      return;
    }
    entries.forEach(({ message, timestamp }) => {
      const item = document.createElement('li');
      const time = document.createElement('time');
      const date = new Date(timestamp);
      time.dateTime = date.toISOString();
      time.textContent = formatTimestamp(timestamp);
      const text = document.createElement('span');
      text.textContent = message;
      item.append(time, text);
      list.appendChild(item);
    });
  };

  const showError = () => {
    if (!root || !list) return;
    root.hidden = false;
    if (error) {
      error.textContent = t('ui.statusHistoryStorageFailed');
      error.hidden = false;
    }
  };

  return Object.freeze({ render, showError });
};
