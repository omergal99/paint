// Functional palette controller. State stays private in this factory and the
// returned API preserves the small contract used by Sidebar and main.js.
import {
  COLOR_PALETTE_1,
  COLOR_PALETTE_2,
  COLOR_PALETTE_3,
  COLOR_PALETTE_4,
  COLOR_PALETTES,
  COLOR_PALETTE_MAX,
  PALETTE_PAGE_IDS,
  colorPalettePreset,
  extendedPickerColors,
  migrateLegacyPalette,
  normalizePalettePage,
} from '../utils/color.js';
import { colorStateToCss } from '../utils/colorContract.js';
import { t } from '../i18n/messages.js';
import { getIconHtml } from './icons/index.js';

const COLOR_RE = /^#[0-9a-f]{6}$/i;
// v3 refreshes the default palette; the loader keeps customised colours and
// only upgrades a still-untouched legacy palette (see migrateLegacyPalette).
const COLOR_SCHEMA_VERSION = 3;

const openColorPicker = (input) => {
  if (!input) return;
  try {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
  } catch {
    // Browsers may reject showPicker outside a trusted activation. The click
    // fallback keeps older engines and hidden inputs working.
  }
  input.click();
};

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
  let palette = normalizePalette(migrateLegacyPalette(savedColors.palette) || COLOR_PALETTE_1);
  // Optional snapshot so the settings can offer "Custom (saved)" next to the
  // built-in presets without losing the user's edited swatches on a switch.
  let savedPalette = normalizeSavedPalette(savedColors.savedPalette);
  // Which built-in page the ribbon arrows show: cycles p1 -> p2 -> p3 -> p4.
  // Persisted so the chosen palette survives reloads and stays in sync with
  // whatever page the user arrowed to before editing a swatch.
  let palettePage = normalizePalettePage(savedColors.palettePage, palette);
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

  // The ribbon grid plus any extra grids (the sidebar picker) render from the
  // same palette, so one slot edit updates every surface at once.
  // `mode` decides the shape: the compact ribbon shows the active page plus the
  // two pager arrows; the roomy sidebar picker lists every built-in palette.
  const grids = new Map();
  const RIBBON_MODE = 'ribbon';
  const EXTENDED_MODE = 'extended';
  // The ribbon grid is the controller's primary surface; later surfaces (the
  // sidebar picker) register themselves through mountGrid.
  if (gridEl) grids.set(gridEl, RIBBON_MODE);
  const createSwatchButton = (hex, index = null) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.background = hex;
    button.title = hex;
    button.dataset.tag = 'palette-swatch';
    button.dataset.color = hex;
    button.setAttribute('aria-label', t('ui.paletteSwatch', { hex }));
    button.addEventListener('click', () => setPrimary(hex));
    // Slot editing only makes sense for the ribbon grid, where the index maps to
    // a cell the user can actually overwrite. The extended picker just selects.
    if (Number.isInteger(index)) {
      button.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        openPaletteMenu(index, event);
      });
    }
    return button;
  };
  // The two trailing cells of the 3x10 ribbon grid are pager arrows instead of
  // colours. They cycle the built-in palettes in order, so a user reaches all
  // four pages without leaving the ribbon.
  const createPagerArrow = (direction) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'palette-pager';
    button.dataset.tag = direction < 0 ? 'palette-page-prev' : 'palette-page-next';
    button.dataset.direction = String(direction);
    button.title = t(direction < 0 ? 'ui.palettePagePrevious' : 'ui.palettePageNext');
    button.setAttribute('aria-label', button.title);
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 20 20');
    icon.setAttribute('class', 'palette-pager-icon');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    // Chevron pointing inline-start; CSS flips it per direction/ribbon side.
    path.setAttribute('d', 'M12.5 4 7 10l5.5 6');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2');
    icon.append(path);
    button.append(icon);
    button.addEventListener('click', () => cyclePalettePage(direction));
    return button;
  };
  const renderGridInto = (grid, mode) => {
    grid.innerHTML = '';
    if (mode === EXTENDED_MODE) {
      extendedPickerColors().forEach((hex) => grid.appendChild(createSwatchButton(hex)));
      return;
    }
    palette.forEach((hex, index) => grid.appendChild(createSwatchButton(hex, index)));
    grid.append(createPagerArrow(-1), createPagerArrow(1));
  }
  const renderGrid = () => {
    [...grids].forEach(([grid, mode]) => {
      if (grid.isConnected === false) {
        grids.delete(grid);
        return;
      }
      renderGridInto(grid, mode);
    });
  }
  const mountGrid = (grid, { mode = RIBBON_MODE } = {}) => {
    if (!grid) return;
    grids.set(grid, mode);
    renderGridInto(grid, mode);
  }
  const unmountGrid = (grid) => {
    if (grid) grids.delete(grid);
  }
  // Keeps every mounted grid (ribbon + sidebar picker) listening to the same
  // write path instead of mirroring palette logic in the Sidebar.
  const notifyPaletteChange = () => {
    if (typeof window === 'undefined' || typeof CustomEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent('paint:palette-change'));
  }

  const closePaletteMenu = ({ preserveEditing = false } = {}) => {
    if (!paletteMenu) return;
    paletteMenu.hidden = true;
    paletteMenu.classList.remove('open');
    if (!preserveEditing) editingPaletteIndex = null;
  };

  const editPaletteSlot = (index) => {
    const hex = palette[index];
    if (!COLOR_RE.test(hex)) return;
    editingPaletteIndex = index;
    editing = 'palette';
    colorPickerInput.value = hex;
    openColorPicker(colorPickerInput);
    closePaletteMenu({ preserveEditing: true });
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
    document.dispatchEvent(new CustomEvent('paint:action-menu-open-at', {
      detail: { menu: paletteMenu, x: event.clientX + 4, y: event.clientY + 4 },
    }));
    paletteMenu.querySelector('button')?.focus();
  };

  const createPaletteMenu = () => {
    paletteMenu = document.createElement('div');
    paletteMenu.className = 'action-menu color-palette-context-menu';
    paletteMenu.hidden = true;
    const items = document.createElement('div');
    items.className = 'action-menu-items color-palette-context-menu-items';
    items.setAttribute('role', 'menu');
    items.setAttribute('aria-label', 'Palette color actions');
    const actions = [
      ['edit', 'Edit color'],
      ['primary', 'Set as foreground'],
      ['secondary', 'Set as background'],
      ['reset', 'Reset slot'],
    ];
    // Glyphs come from the shared js/ui/icons registry - one file per SVG.
    const iconNames = {
      edit: 'paletteEdit',
      primary: 'palettePrimary',
      secondary: 'paletteSecondary',
      reset: 'paletteReset',
    };
    actions.forEach(([action, label]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = action;
      button.setAttribute('role', 'menuitem');
      button.insertAdjacentHTML('beforeend', getIconHtml(iconNames[action]));
      const text = document.createElement('span');
      text.textContent = label;
      button.append(text);
      button.addEventListener('click', () => {
        const index = Number(paletteMenu.dataset.index);
        const hex = palette[index];
        if (!Number.isInteger(index) || !COLOR_RE.test(hex)) return closePaletteMenu();
        if (action === 'edit') editPaletteSlot(index);
        if (action === 'primary') { setPrimary(hex); closePaletteMenu(); }
        if (action === 'secondary') { setSecondary(hex); closePaletteMenu(); }
        if (action === 'reset') {
          const preset = colorPalettePreset(palette) === 'p2' ? COLOR_PALETTE_2 : COLOR_PALETTE_1;
          updatePaletteSlot(index, preset[index] || '#ffffff');
          closePaletteMenu();
        }
      });
      items.appendChild(button);
    });
    paletteMenu.appendChild(items);
    document.body.appendChild(paletteMenu);
  };

  const openPicker = (which) => {
    editing = which;
    editingPaletteIndex = null;
    colorPickerInput.value = which === 'secondary' ? secondary : primary;
    openColorPicker(colorPickerInput);
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
    notifyPaletteChange();
    return true;
  }

  const getPageColors = (page) => {
    if (page === 'p1') return [...COLOR_PALETTE_1];
    if (page === 'p2') return [...COLOR_PALETTE_2];
    if (page === 'p3') return [...COLOR_PALETTE_3];
    if (page === 'p4') return [...COLOR_PALETTE_4];
    return [...COLOR_PALETTE_1];
  };
  // Ribbon pager arrows cycle the built-in palettes in order (1 -> 2 -> 3 -> 4).
  // Persisted, so the chosen page survives reloads next to the edited palette.
  const setPalettePage = (page, { persist = true } = {}) => {
    if (!PALETTE_PAGE_IDS.includes(page)) return false;
    palettePage = page;
    palette = normalizePalette(getPageColors(page));
    renderGrid();
    if (persist) saveColors();
    notifyPaletteChange();
    return true;
  };
  const cyclePalettePage = (direction = 1) => {
    const order = PALETTE_PAGE_IDS;
    const current = order.indexOf(palettePage);
    const next = order[(current < 0 ? 0 : current + direction + order.length) % order.length];
    return setPalettePage(next);
  };

  // Settings-side preset switcher: pages are plain palette writes so every
  // grid follows; p3/p4 mirror the sidebar picker views.
  const applyPalette = (preset) => {
    if (preset === 'p3' || preset === 'p4') return setPalettePage(preset);
    return setPalette([...(preset === 'p2' ? COLOR_PALETTE_2 : COLOR_PALETTE_1)]);
  };
  const applySavedPalette = () => (savedPalette ? setPalette([...savedPalette]) : false);
  const savePaletteSnapshot = () => {
    savedPalette = [...palette];
    saveColors();
    return true;
  };

  const setDefaultPrimary = (hex) => {
    if (!COLOR_RE.test(hex)) return false;
    defaultPrimary = hex.toLowerCase();
    saveColors();
    return true;
  }

  const resetToDefaults = () => {
    palette = [...COLOR_PALETTE_1];
    palettePage = 'p1';
    defaultPrimary = '#a349a4';
    primary = defaultPrimary;
    secondary = '#ffffff';
    primaryAlpha = 1;
    secondaryAlpha = 1;
    renderGrid();
    renderPrimary();
    renderSecondary();
    saveColors();
    notifyPaletteChange();
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
        savedPalette,
        palettePage,
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
    get savedPalette() { return savedPalette ? [...savedPalette] : null; },
    get palettePage() { return palettePage; },
    setPrimary,
    setSecondary,
    getPalette,
    setPalette,
    setDefaultPrimary,
    resetToDefaults,
    mountGrid,
    unmountGrid,
    applyPalette,
    applySavedPalette,
    savePaletteSnapshot,
    setPalettePage,
    cyclePalettePage,
  });
}

const normalizeAlpha = (value) => {
  const alpha = Number(value);
  return Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
}

const normalizePalette = (colors) => {
  if (!Array.isArray(colors)) return [...COLOR_PALETTE_1];
  const valid = colors
    .filter((hex) => typeof hex === 'string' && COLOR_RE.test(hex))
    .map((hex) => hex.toLowerCase())
    // The ribbon grid is exactly 3x10; longer arrays would wrap into a fourth
    // row and break the 50px control band.
    .slice(0, COLOR_PALETTE_MAX);
  return valid.length ? valid : [...COLOR_PALETTE_1];
}

const normalizeSavedPalette = (colors) => {
  if (!Array.isArray(colors)) return null;
  const valid = colors.filter((hex) => typeof hex === 'string' && COLOR_RE.test(hex));
  return valid.length ? normalizePalette(valid) : null;
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
