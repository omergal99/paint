// Functional palette controller. State stays private in this factory and the
// returned API preserves the small contract used by Sidebar and main.js.
import { DEFAULT_PALETTE } from '../utils/color.js';
import { colorStateToCss } from '../utils/colorContract.js';

const COLOR_RE = /^#[0-9a-f]{6}$/i;
const COLOR_SCHEMA_VERSION = 2;

export const createColorPalette = ({
  gridEl,
  primarySwatchEl,
  secondarySwatchEl,
  colorPickerInput,
  primaryAlphaInput,
  secondaryAlphaInput,
  primaryAlphaOutput,
  secondaryAlphaOutput,
  primaryTransparentButton,
  secondaryTransparentButton,
  onPrimaryChange,
  onSecondaryChange,
}) => {
  const savedColors = loadSavedColors();
  let palette = normalizePalette(savedColors.palette || DEFAULT_PALETTE);
  let defaultPrimary = COLOR_RE.test(savedColors.defaultPrimary || '') ? savedColors.defaultPrimary.toLowerCase() : '#a349a4';
  let primary = COLOR_RE.test(savedColors.primary || '') ? savedColors.primary.toLowerCase() : defaultPrimary;
  let secondary = COLOR_RE.test(savedColors.secondary || '') ? savedColors.secondary.toLowerCase() : '#ffffff';
  let primaryAlpha = normalizeAlpha(savedColors.primaryAlpha);
  let secondaryAlpha = normalizeAlpha(savedColors.secondaryAlpha);
  let editing = 'primary';
  let editingPaletteIndex = null;
  let paletteMenu = null;

  const renderSwatch = (element, hex, alpha, label) => {
    if (!element) return;
    element.style.backgroundColor = colorStateToCss({ hex, alpha });
    element.style.backgroundImage = alpha < 1
      ? 'linear-gradient(45deg, #d7d7d7 25%, transparent 25%, transparent 75%, #d7d7d7 75%), linear-gradient(45deg, #d7d7d7 25%, transparent 25%, transparent 75%, #d7d7d7 75%)'
      : 'none';
    element.style.backgroundSize = alpha < 1 ? '8px 8px' : '';
    element.style.backgroundPosition = alpha < 1 ? '0 0, 4px 4px' : '';
    element.title = `${label}: ${hex}, ${Math.round(alpha * 100)}% opacity${alpha === 0 ? ' (transparent)' : ''}`;
    element.dataset.alpha = String(alpha);
  };

  const renderAlphaControl = (input, output, alpha) => {
    if (input) input.value = String(Math.round(alpha * 100));
    if (output) output.value = `${Math.round(alpha * 100)}%`;
    if (output) output.textContent = `${Math.round(alpha * 100)}%`;
  };

  const renderPrimary = () => {
    renderSwatch(primarySwatchEl, primary, primaryAlpha, 'Foreground');
    renderAlphaControl(primaryAlphaInput, primaryAlphaOutput, primaryAlpha);
  };

  const renderSecondary = () => {
    renderSwatch(secondarySwatchEl, secondary, secondaryAlpha, 'Background');
    renderAlphaControl(secondaryAlphaInput, secondaryAlphaOutput, secondaryAlpha);
  };

  const renderGrid = () => {
    gridEl.innerHTML = '';
    palette.forEach((hex, index) => {
      const button = document.createElement('button');
      button.style.background = hex;
      button.title = hex;
      button.setAttribute('aria-label', `Palette color ${hex}`);
      button.addEventListener('click', () => setPrimary(hex));
      button.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        openPaletteMenu(index, event);
      });
      gridEl.appendChild(button);
    });
  }

  const closePaletteMenu = () => {
    if (!paletteMenu) return;
    paletteMenu.hidden = true;
    editingPaletteIndex = null;
  };

  const editPaletteSlot = (index) => {
    const hex = palette[index];
    if (!COLOR_RE.test(hex)) return;
    editingPaletteIndex = index;
    colorPickerInput.value = hex;
    colorPickerInput.click();
    paletteMenu.hidden = true;
  };

  const updatePaletteSlot = (index, hex) => {
    if (!Number.isInteger(index) || !COLOR_RE.test(hex)) return false;
    const next = [...palette];
    next[index] = hex.toLowerCase();
    return setPalette(next);
  };

  const openPaletteMenu = (index, event) => {
    if (!paletteMenu || !Number.isInteger(index)) return;
    paletteMenu.dataset.index = String(index);
    paletteMenu.hidden = false;
    const width = 180;
    const height = 136;
    paletteMenu.style.left = `${Math.min(event.clientX, window.innerWidth - width - 8)}px`;
    paletteMenu.style.top = `${Math.min(event.clientY, window.innerHeight - height - 8)}px`;
    paletteMenu.querySelector('button')?.focus();
  };

  const createPaletteMenu = () => {
    paletteMenu = document.createElement('div');
    paletteMenu.className = 'color-palette-context-menu';
    paletteMenu.setAttribute('role', 'menu');
    paletteMenu.setAttribute('aria-label', 'Palette color actions');
    paletteMenu.hidden = true;
    const actions = [
      ['edit', 'Edit color'],
      ['primary', 'Set as foreground'],
      ['secondary', 'Set as background'],
      ['reset', 'Reset slot'],
    ];
    actions.forEach(([action, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = action;
      button.setAttribute('role', 'menuitem');
      button.textContent = label;
      button.addEventListener('click', () => {
        const index = Number(paletteMenu.dataset.index);
        const hex = palette[index];
        if (!Number.isInteger(index) || !COLOR_RE.test(hex)) return closePaletteMenu();
        if (action === 'edit') editPaletteSlot(index);
        if (action === 'primary') { setPrimary(hex); closePaletteMenu(); }
        if (action === 'secondary') { setSecondary(hex); closePaletteMenu(); }
        if (action === 'reset') {
          updatePaletteSlot(index, DEFAULT_PALETTE[index] || '#ffffff');
          closePaletteMenu();
        }
      });
      paletteMenu.appendChild(button);
    });
    document.body.appendChild(paletteMenu);
    document.addEventListener('click', (event) => {
      if (!paletteMenu.contains(event.target)) closePaletteMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closePaletteMenu();
    });
  };

  const openPicker = (which) => {
    editing = which;
    editingPaletteIndex = null;
    colorPickerInput.value = which === 'secondary' ? secondary : primary;
    colorPickerInput.click();
  }

  const bindSwatches = () => {
    primarySwatchEl.addEventListener('click', () => openPicker('primary'));
    secondarySwatchEl.addEventListener('click', () => openPicker('secondary'));
    colorPickerInput.addEventListener('input', () => {
      if (Number.isInteger(editingPaletteIndex)) updatePaletteSlot(editingPaletteIndex, colorPickerInput.value);
      else if (editing === 'secondary') setSecondary(colorPickerInput.value);
      else setPrimary(colorPickerInput.value);
    });
    colorPickerInput.addEventListener('change', () => {
      if (Number.isInteger(editingPaletteIndex)) closePaletteMenu();
    });
    primaryAlphaInput?.addEventListener('input', () => setPrimary(primary, Number(primaryAlphaInput.value) / 100));
    secondaryAlphaInput?.addEventListener('input', () => setSecondary(secondary, Number(secondaryAlphaInput.value) / 100));
    primaryTransparentButton?.addEventListener('click', () => setPrimary(primary, 0));
    secondaryTransparentButton?.addEventListener('click', () => setSecondary(secondary, 0));
  }

  const setPrimary = (hex, alpha = primaryAlpha) => {
    if (!COLOR_RE.test(hex)) return false;
    primary = hex.toLowerCase();
    primaryAlpha = normalizeAlpha(alpha);
    renderPrimary();
    saveColors();
    onPrimaryChange?.(primary, primaryAlpha);
    return true;
  }

  const setSecondary = (hex, alpha = secondaryAlpha) => {
    if (!COLOR_RE.test(hex)) return false;
    secondary = hex.toLowerCase();
    secondaryAlpha = normalizeAlpha(alpha);
    renderSecondary();
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
    renderPrimary();
    renderSecondary();
    saveColors();
    onPrimaryChange?.(primary, primaryAlpha);
    onSecondaryChange?.(secondary, secondaryAlpha);
  }

  const saveColors = () => {
    try {
      localStorage.setItem('paint:colors', JSON.stringify({
        schemaVersion: COLOR_SCHEMA_VERSION,
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

  createPaletteMenu();
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
