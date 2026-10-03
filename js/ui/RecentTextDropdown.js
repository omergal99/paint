const normalizeEntryText = (text) => String(text || '').replace(/\s+/g, ' ').trim();
const OPTION_PREVIEW_LENGTH = 80;

const getPreviewText = (text, fallback) => {
  const normalized = normalizeEntryText(text) || fallback;
  return normalized.length > OPTION_PREVIEW_LENGTH
    ? `${normalized.slice(0, OPTION_PREVIEW_LENGTH - 1)}…`
    : normalized;
};

export const createRecentTextDropdown = ({
  documentRef = globalThis.document,
  label,
  labelId,
  placeholder,
  onSelect,
} = {}) => {
  if (!documentRef?.createElement) throw new Error('Recent text dropdown requires a document');

  const select = documentRef.createElement('select');
  select.id = 'text-history-select';
  select.name = 'textHistorySelect';
  select.className = 'text-history-select';
  select.setAttribute('aria-label', label);
  if (labelId) select.setAttribute('aria-labelledby', labelId);
  select.title = placeholder;

  let entries = [];
  const handleChange = () => {
    const entry = entries.find((item) => item.id === select.value);
    if (!entry) return;
    select.title = entry.text;
    onSelect?.(entry);
  };
  select.addEventListener('change', handleChange);

  const setEntries = (nextEntries = []) => {
    const selectedId = select.value;
    entries = nextEntries.map((entry) => ({ ...entry }));
    select.replaceChildren();

    const emptyOption = documentRef.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = placeholder;
    emptyOption.title = placeholder;
    emptyOption.disabled = entries.length === 0;
    select.appendChild(emptyOption);

    entries.forEach((entry) => {
      const option = documentRef.createElement('option');
      option.value = entry.id;
      option.textContent = getPreviewText(entry.text, placeholder);
      option.title = entry.text || placeholder;
      select.appendChild(option);
    });

    select.disabled = entries.length === 0;
    select.value = entries.some((entry) => entry.id === selectedId) ? selectedId : '';
    const selected = entries.find((entry) => entry.id === select.value);
    select.title = selected?.text || placeholder;
  };

  const destroy = () => {
    select.removeEventListener('change', handleChange);
    select.remove();
  };

  return Object.freeze({ element: select, setEntries, destroy });
};
