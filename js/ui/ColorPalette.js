// Functional palette controller. State stays private in this factory and the
// returned API preserves the small contract used by Sidebar and main.js.
import { DEFAULT_PALETTE } from '../utils/color.js';

const COLOR_RE = /^#[0-9a-f]{6}$/i;

export const createColorPalette = ({ gridEl, primarySwatchEl, secondarySwatchEl, colorPickerInput, onPrimaryChange, onSecondaryChange }) => {
  const savedColors = loadSavedColors();
  let palette = normalizePalette(savedColors.palette || DEFAULT_PALETTE);
  let defaultPrimary = COLOR_RE.test(savedColors.defaultPrimary || '') ? savedColors.defaultPrimary.toLowerCase() : '#a349a4';
  let primary = COLOR_RE.test(savedColors.primary || '') ? savedColors.primary.toLowerCase() : defaultPrimary;
  let secondary = COLOR_RE.test(savedColors.secondary || '') ? savedColors.secondary.toLowerCase() : '#ffffff';
  let primaryAlpha = normalizeAlpha(savedColors.primaryAlpha);
  let secondaryAlpha = normalizeAlpha(savedColors.secondaryAlpha);
  let editing = 'primary';

  const renderGrid = () => {
    gridEl.innerHTML = '';
    palette.forEach((hex) => {
      const button = document.createElement('button');
      button.style.background = hex;
      button.title = hex;
      button.addEventListener('click', () => setPrimary(hex));
      button.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        setSecondary(hex);
      });
      gridEl.appendChild(button);
    });
  }

  const openPicker = (which) => {
    editing = which;
    colorPickerInput.value = which === 'secondary' ? secondary : primary;
    colorPickerInput.click();
  }

  const bindSwatches = () => {
    primarySwatchEl.addEventListener('click', () => openPicker('primary'));
    secondarySwatchEl.addEventListener('click', () => openPicker('secondary'));
    colorPickerInput.addEventListener('input', () => {
      if (editing === 'secondary') setSecondary(colorPickerInput.value);
      else setPrimary(colorPickerInput.value);
    });
  }

  const setPrimary = (hex, alpha = primaryAlpha) => {
    if (!COLOR_RE.test(hex)) return false;
    primary = hex.toLowerCase();
    primaryAlpha = normalizeAlpha(alpha);
    primarySwatchEl.style.background = primary;
    saveColors();
    onPrimaryChange?.(primary, primaryAlpha);
    return true;
  }

  const setSecondary = (hex, alpha = secondaryAlpha) => {
    if (!COLOR_RE.test(hex)) return false;
    secondary = hex.toLowerCase();
    secondaryAlpha = normalizeAlpha(alpha);
    secondarySwatchEl.style.background = secondary;
    saveColors();
    onSecondaryChange?.(secondary, secondaryAlpha);
    return true;
  }

  const getPalette = () => { return [...palette]; }

  const setPalette = (colors) => {
    const next = normalizePalette(colors);
    if (!next.length) return false;
    palette = next;
    renderGrid();
    saveColors();
    return true;
  }

  const setDefaultPrimary = (hex) => {
    if (!COLOR_RE.test(hex)) return false;
    defaultPrimary = hex.toLowerCase();
    saveColors();
    return true;
  }

  const resetToDefaults = () => {
    palette = [...DEFAULT_PALETTE];
    defaultPrimary = '#a349a4';
    primary = defaultPrimary;
    secondary = '#ffffff';
    primaryAlpha = 1;
    secondaryAlpha = 1;
    renderGrid();
    primarySwatchEl.style.background = primary;
    secondarySwatchEl.style.background = secondary;
    saveColors();
    onPrimaryChange?.(primary, primaryAlpha);
    onSecondaryChange?.(secondary, secondaryAlpha);
  }

  const saveColors = () => {
    try {
      localStorage.setItem('paint:colors', JSON.stringify({
        primary,
        secondary,
        primaryAlpha,
        secondaryAlpha,
        defaultPrimary,
        palette,
      }));
    } catch (error) {
      console.warn('Unable to save colors:', error);
    }
  }

  renderGrid();
  bindSwatches();
  setPrimary(primary, primaryAlpha);
  setSecondary(secondary, secondaryAlpha);

  return Object.freeze({
    get palette() { return palette; },
    get primary() { return primary; },
    get secondary() { return secondary; },
    get primaryAlpha() { return primaryAlpha; },
    get secondaryAlpha() { return secondaryAlpha; },
    get defaultPrimary() { return defaultPrimary; },
    setPrimary,
    setSecondary,
    getPalette,
    setPalette,
    setDefaultPrimary,
    resetToDefaults,
  });
}

const normalizeAlpha = (value) => {
  const alpha = Number(value);
  return Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
}

const normalizePalette = (colors) => {
  if (!Array.isArray(colors)) return [...DEFAULT_PALETTE];
  const valid = colors.filter((hex) => typeof hex === 'string' && COLOR_RE.test(hex));
  return valid.length ? valid.map((hex) => hex.toLowerCase()) : [...DEFAULT_PALETTE];
}

const loadSavedColors = () => {
  try {
    const saved = localStorage.getItem('paint:colors');
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.warn('Unable to load colors:', error);
    return {};
  }
}
