// js/tools/EmojiStore.js
// System-emoji catalog for the Shapes gallery. The OS renders the glyph
// (color emoji font), so no assets are needed. Persisted last-pick included.

export const EMOJI_CATALOG = Object.freeze([
  '😀', '😎', '😍', '🤣', '😮', '😢', '😡', '👍', '👏', '🙏',
  '❤️', '🔥', '⭐', '🎉', '💡', '✅', '❌', '⚠️', '🚀', '🎨',
]);

const EMOJI_KEY = 'paint:selected-emoji';

export const getSelectedEmoji = () => {
  try {
    const saved = localStorage.getItem(EMOJI_KEY);
    if (saved) return saved;
  } catch {}
  return EMOJI_CATALOG[0];
}

export const setSelectedEmoji = (emoji) => {
  try { localStorage.setItem(EMOJI_KEY, emoji); } catch {}
}

export const renderEmojiGrid = ({ container, onPick } = {}) => {
  if (!container) return;
  container.innerHTML = '';
  const current = getSelectedEmoji();
  EMOJI_CATALOG.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shape-emoji-btn';
    btn.textContent = emoji;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', emoji === current ? 'true' : 'false');
    btn.title = `Use ${emoji}`;
    if (emoji === current) btn.classList.add('active');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setSelectedEmoji(emoji);
      container.querySelectorAll('.shape-emoji-btn').forEach((b) => {
        const on = b.textContent === emoji;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      onPick?.(emoji);
    });
    container.appendChild(btn);
  });
}
