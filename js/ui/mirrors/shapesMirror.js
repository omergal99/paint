// js/ui/mirrors/shapesMirror.js
// Phase 2 step-03 SSOT: Shapes ribbon group -> RibbonMirror descriptor plus
// the shared favorites list used by the mirror AND the ribbon dropdown.
// - Shapes are read from the ribbon gallery (one source for the shape list).
// - Picking a shape clicks the ribbon tile, so Toolbar.selectShape stays the
//   single writer for selection state.
// - favoriteShapes persists in SettingsStore; both views subscribe to it.
import { t } from '../../i18n/messages.js';
import { createLineSizeSlider } from './lineSizeControl.js';

// Shapes without a dedicated message key (x, v) fall back to the ribbon title.
export const SHAPE_I18N_KEYS = Object.freeze({
  line: 'ui.line',
  arrow: 'ui.arrow',
  rectangle: 'ui.rectangle',
  'rounded-rectangle': 'ui.rounded',
  'right-triangle': 'ui.rightTriangle',
  diamond: 'ui.diamond',
  pentagon: 'ui.pentagon',
  hexagon: 'ui.hexagon',
  star: 'ui.star',
  heart: 'ui.heart',
  plus: 'ui.plus',
  'double-arrow': 'ui.doubleArrow',
  ellipse: 'ui.ellipse',
  triangle: 'ui.triangle',
  emoji: 'ui.emoji',
});

const normalizeText = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

export const toggleFavoriteShape = (favorites, kind) => {
  const list = Array.isArray(favorites) ? favorites.filter((item) => typeof item === 'string' && item) : [];
  if (!kind) return list;
  return list.includes(kind) ? list.filter((item) => item !== kind) : [...list, kind];
};

// Candidates carry the translated label plus the ribbon title so a search
// matches in the active locale and in English source text.
export const matchShapeQuery = (query, candidates = []) => {
  const needle = normalizeText(query);
  if (!needle) return candidates;
  return candidates.filter((candidate) => [candidate.label, candidate.title]
    .some((value) => normalizeText(value).includes(needle)));
};

let favoritesStore = null;
let subscribed = false;
let ribbonMounted = false;
const hosts = new Set();

const notifyHosts = () => {
  for (const host of [...hosts]) {
    if (!host.el.isConnected) hosts.delete(host);
    else host.render();
  }
};
const registerHost = (el, render) => {
  for (const host of [...hosts]) {
    if (!host.el.isConnected) hosts.delete(host);
  }
  hosts.add({ el, render });
};
export const configureShapesFavorites = (settingsStore) => {
  // Guard loudly: silently dropping the store would look like "favorites do
  // not save" with no clue why.
  if (typeof settingsStore?.subscribe !== 'function') {
    console.warn('configureShapesFavorites needs the SettingsStore instance; shape favorites stay empty');
    return;
  }
  favoritesStore = settingsStore;
  if (!subscribed) {
    subscribed = true;
    settingsStore.subscribe(notifyHosts);
  }
  notifyHosts();
};
const getFavorites = () => {
  const value = favoritesStore?.get?.()?.favoriteShapes;
  return Array.isArray(value) ? value : [];
};
const setFavorites = (next) => favoritesStore?.set?.({ favoriteShapes: next });

const allShapeKinds = () => [...document.querySelectorAll('.shape-gallery-grid .shape-btn[data-shape]')]
  .map((button) => button.dataset.shape)
  .filter((kind, index, kinds) => kinds.indexOf(kind) === index);
const ribbonTile = (kind) => document.querySelector(`.shape-gallery-grid [data-tag="shape-${kind}"]`);
const shapeLabel = (kind, tile) => {
  const key = SHAPE_I18N_KEYS[kind];
  return key ? t(key) : (tile?.title || kind);
};
// Mirror + ribbon-favorites tile: cloned icon, translated label, star toggle.
// It never carries .shape-btn, so only its own listener (which clicks the
// ribbon tile) reacts - no second selection path.
const buildShapeTile = (kind, tagPrefix) => {
  const tile = ribbonTile(kind);
  const key = SHAPE_I18N_KEYS[kind];
  const cell = document.createElement('div');
  cell.className = 'mirror-shape-cell';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'rbtn cell mirror-shape-tile';
  button.dataset.tag = `${tagPrefix}-${kind}`;
  const icon = tile?.querySelector('svg');
  if (icon) button.append(icon.cloneNode(true));
  const label = document.createElement('span');
  label.textContent = shapeLabel(kind, tile);
  if (key) label.setAttribute('data-i18n-runtime', key);
  button.append(label);
  button.title = label.textContent;
  button.addEventListener('click', () => tile?.click());
  const star = document.createElement('button');
  star.type = 'button';
  star.className = 'mirror-fav-toggle';
  star.dataset.tag = `${tagPrefix}-fav-${kind}`;
  const starLabel = t('ui.toggleFavorite');
  star.setAttribute('aria-label', starLabel);
  star.setAttribute('data-i18n-runtime-aria-label', 'ui.toggleFavorite');
  star.title = starLabel;
  const syncStar = () => {
    const active = getFavorites().includes(kind);
    star.setAttribute('aria-pressed', String(active));
    star.classList.toggle('is-fav', active);
    star.textContent = active ? '★' : '☆';
  };
  star.addEventListener('click', (event) => {
    event.stopPropagation();
    setFavorites(toggleFavoriteShape(getFavorites(), kind));
    syncStar();
  });
  syncStar();
  cell.append(button, star);
  return cell;
};

const mountShapeBrowser = (host) => {
  host.dataset.tag = 'sidebar-mirror-shape-browser';
  host.classList.add('mirror-shape-browser');
  let query = '';
  const input = document.createElement('input');
  input.type = 'search';
  input.className = 'mirror-search-input';
  const searchLabel = t('ui.mirrorSearchShapes');
  input.placeholder = searchLabel;
  input.setAttribute('data-i18n-runtime-placeholder', 'ui.mirrorSearchShapes');
  input.setAttribute('aria-label', searchLabel);
  input.setAttribute('data-i18n-runtime-aria-label', 'ui.mirrorSearchShapes');
  const empty = document.createElement('p');
  empty.className = 'mirror-note';
  empty.textContent = t('ui.mirrorNoShapeMatches');
  empty.setAttribute('data-i18n-runtime', 'ui.mirrorNoShapeMatches');
  empty.hidden = true;
  const grid = document.createElement('div');
  grid.className = 'mirror-shape-grid';
  const candidates = () => allShapeKinds().map((kind) => {
    const tile = ribbonTile(kind);
    return { kind, label: shapeLabel(kind, tile), title: tile?.title || '' };
  });
  const render = () => {
    const matched = matchShapeQuery(query, candidates());
    grid.replaceChildren(...matched.map((candidate) => buildShapeTile(candidate.kind, 'sidebar-mirror-shape')));
    empty.hidden = matched.length > 0;
  };
  input.addEventListener('input', () => {
    query = input.value;
    render();
  });
  registerHost(grid, render);
  host.append(input, empty, grid);
  render();
};

const mountShapeFavorites = (host) => {
  host.dataset.tag = 'sidebar-mirror-shape-favorites';
  host.classList.add('mirror-shape-favorites');
  const note = document.createElement('p');
  note.className = 'mirror-note';
  note.textContent = t('ui.mirrorNoFavorites');
  note.setAttribute('data-i18n-runtime', 'ui.mirrorNoFavorites');
  const list = document.createElement('div');
  list.className = 'mirror-shape-grid';
  const render = () => {
    const favorites = getFavorites().filter((kind) => allShapeKinds().includes(kind));
    note.hidden = favorites.length > 0;
    list.replaceChildren(...favorites.map((kind) => buildShapeTile(kind, 'sidebar-mirror-favorite')));
  };
  registerHost(list, render);
  host.append(note, list);
  render();
};

export const shapesMirrorDescriptor = Object.freeze({
  key: 'shapes',
  titleKey: 'ribbon.groups.shapes',
  layout: 'sections',
  visibility: true,
  sections: Object.freeze([
    Object.freeze({
      id: 'all-shapes',
      titleKey: 'ui.mirrorAllShapes',
      open: false,
      items: Object.freeze([Object.freeze({ kind: 'custom', mount: mountShapeBrowser })]),
    }),
    Object.freeze({
      id: 'favorites',
      titleKey: 'ui.mirrorFavorites',
      open: false,
      items: Object.freeze([Object.freeze({ kind: 'custom', mount: mountShapeFavorites })]),
    }),
    Object.freeze({
      id: 'size',
      titleKey: 'ui.mirrorSize',
      open: false,
      items: Object.freeze([createLineSizeSlider({ tag: 'sidebar-mirror-shape-size', labelKey: 'ui.mirrorSize' })]),
    }),
  ]),
});

// Ribbon side of the same favorites store: a compact row pinned at the top of
// the Shapes dropdown (btn-shapes-menu gallery), hidden while empty.
export const initRibbonShapeFavorites = () => {
  if (ribbonMounted) return;
  const gallery = document.querySelector('.action-menu-items.shape-gallery');
  if (!gallery) return;
  ribbonMounted = true;
  const container = document.createElement('div');
  container.className = 'shape-favorites';
  container.dataset.tag = 'shape-favorites';
  const heading = document.createElement('span');
  heading.className = 'shape-favorites-title';
  heading.textContent = t('ui.mirrorFavorites');
  heading.setAttribute('data-i18n-runtime', 'ui.mirrorFavorites');
  const list = document.createElement('div');
  list.className = 'shape-favorites-list';
  container.append(heading, list);
  gallery.prepend(container);
  const render = () => {
    const favorites = getFavorites().filter((kind) => allShapeKinds().includes(kind));
    container.hidden = favorites.length === 0;
    list.replaceChildren(...favorites.map((kind) => buildShapeTile(kind, 'shape-fav')));
  };
  registerHost(list, render);
  render();
};