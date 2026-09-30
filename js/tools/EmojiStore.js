// js/tools/EmojiStore.js
// System-emoji catalog for the Shapes gallery. The OS renders the glyph
// (color emoji font), so no assets are needed. Persisted last-pick included.

export const EMOJI_CATALOG = Object.freeze([
  '😀','😎', '😍','😅','😂','😮','🙏','❤️','🔥','👍','💪','✅', '❌', '⚠️','😃', '😄', '😁', '😆', '😇','😢', '😭', '😡', '🤯', '🥳','🤣', '😊', '🙂', '😉',  '🥰', '😘',  '🤔', '🤗', '😴',
   '👎', '👏', '🙌',  '🤝',  '✌️', '🤞', '👋', '🤟',  '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔',
  '🌈', '☀️', '🌙', '⭐', '🌟', '⚡',  '❄️', '🌊', '🌸', '🌻', '🍀', '🌴', '🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐸', '🐵', '🦄', '🐝', '🦋', '🐢',
  '🍎', '🍓', '🍕', '🍰', '☕', '🎨', '🖌️', '✏️', '📌', '💡',  '🚀', '🎉', '🎁', '💎', '🏆', '⚽', '🎵', '🎮', '📷', '💻',
]);

const EMOJI_KEY = 'paint:selected-emoji';
const emojiGridBindings = new WeakMap();

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

/**
 * Single owner of the emoji picker highlight. The grid cannot know whether the
 * emoji shape is the one currently selected - only the toolbar does - so the
 * grid renders unselected and the toolbar calls this after every shape change.
 * `active: false` clears the highlight without changing the last-picked emoji.
 */
export const syncEmojiSelection = (container, { active = true } = {}) => {
  if (!container) return;
  const current = getSelectedEmoji();
  container.querySelectorAll('.shape-emoji-btn').forEach((item) => {
    const selected = active === true && item.textContent === current;
    item.classList.toggle('active', selected);
    item.setAttribute('aria-selected', selected ? 'true' : 'false');
  });
}

export const renderEmojiGrid = ({ container, onPick } = {}) => {
  if (!container) return;
  let binding = emojiGridBindings.get(container);
  if (!binding) {
    binding = {
      onPick,
      handleClick: (event) => {
        const button = event.target.closest?.('.shape-emoji-btn');
        if (!button || !container.contains(button)) return;
        event.stopPropagation();
        const emoji = button.textContent;
        setSelectedEmoji(emoji);
        syncEmojiSelection(container, { active: true });
        binding.onPick?.(emoji);
      },
    };
    container.addEventListener('click', binding.handleClick);
    emojiGridBindings.set(container, binding);
  }
  binding.onPick = onPick;
  container.innerHTML = '';
  EMOJI_CATALOG.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shape-emoji-btn';
    btn.textContent = emoji;
    btn.setAttribute('role', 'option');
    btn.setAttribute('aria-selected', 'false');
    btn.title = `Use ${emoji}`;
    container.appendChild(btn);
  });
  return () => {
    if (emojiGridBindings.get(container) !== binding) return;
    container.removeEventListener('click', binding.handleClick);
    emojiGridBindings.delete(container);
  };
}
