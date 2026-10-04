// js/ui/RibbonMirror.js
// Phase 2 step-01 SSOT: descriptor-driven sidebar mirror shell.
// Mirrors never own state: actions click the ribbon control, settings
// read/write the same store the ribbon uses.
// Descriptor: { key, titleKey, layout:'sections'|'tabs',
//   sections:[{ id, title, titleKey, open, items:[control] }], visibility:bool }
// Control: { kind:'action', target|targetTag } | { kind:'toggle', get,set,label,labelKey,tag }
//   | { kind:'slider', get,set,label,labelKey,min,max,unit,tag } | { kind:'custom',mount }
// `target` resolves by element id, `targetTag` by the ribbon's data-tag; both
// always point at the ribbon control itself so ribbon and mirror cannot diverge.
// Titles/labels prefer `*Key` fields and carry `data-i18n-runtime` so
// LocaleController re-translates them when the locale changes.
import { t } from '../i18n/messages.js';
import { appendDialogIndicator } from './DialogIndicator.js';
const isFn = (v) => typeof v === 'function';
const mk = (tag, cls = '', text = '') => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};
const findSource = (item) => {
  if (item.target) return document.getElementById(item.target);
  if (item.targetTag) return document.querySelector(`[data-tag="${item.targetTag}"]`);
  return null;
};
const localized = (item, fallback = '') => (item.labelKey ? t(item.labelKey) : String(item.label ?? fallback));
const runtimeKey = (node, key) => {
  if (key) node.setAttribute('data-i18n-runtime', key);
  return node;
};
const buildAction = (item, onAction) => {
  const sourceTag = item.target || item.targetTag;
  const btn = mk('button', 'mirror-action');
  btn.type = 'button';
  if (item.tag) btn.dataset.tag = item.tag;
  if (sourceTag) btn.dataset.sourceTag = sourceTag;
  const source = findSource(item);
  btn.textContent = source?.title || source?.textContent?.trim() || sourceTag || '';
  if (source?.querySelector(':scope > .dialog-arrow-icon')) appendDialogIndicator(btn);
  btn.disabled = !source || source.disabled === true;
  btn.addEventListener('click', () => (isFn(onAction) ? onAction(item) : findSource(item)?.click()));
  return { node: btn, sync: () => { const src = findSource(item); btn.disabled = !src || src.disabled === true; } };
};
const buildToggle = (item) => {
  const row = mk('div', 'checkbox-row');
  if (item.tag) row.dataset.tag = item.tag;
  const input = mk('input');
  input.type = 'checkbox';
  input.checked = Boolean(item.get?.());
  const label = runtimeKey(mk('label', '', localized(item)), item.labelKey);
  input.addEventListener('change', () => item.set?.(input.checked));
  row.append(input, label);
  return { node: row, sync: () => { input.checked = Boolean(item.get?.()); } };
};
const buildSlider = (item) => {
  const row = mk('div', 'mirror-slider-row');
  if (item.tag) row.dataset.tag = item.tag;
  const label = runtimeKey(mk('label', 'mirror-slider-label', localized(item)), item.labelKey);
  const input = mk('input', 'mirror-slider-input');
  input.type = 'range';
  input.id = item.inputId || `${item.tag || 'mirror-slider'}-input`;
  label.htmlFor = input.id;
  input.min = String(item.min ?? 0);
  input.max = String(item.max ?? 100);
  input.value = String(Number(item.get?.()) || 0);
  input.setAttribute('aria-label', localized(item, 'Value'));
  const val = mk('span', 'mirror-slider-value', `${input.value}${item.unit ?? ''}`);
  input.addEventListener('input', () => { val.textContent = `${input.value}${item.unit ?? ''}`; item.set?.(Number(input.value)); });
  row.append(label, input, val);
  return { node: row, sync: () => { input.value = String(Number(item.get?.()) || 0); val.textContent = `${input.value}${item.unit ?? ''}`; } };
};
// Disclosure sections are named for what they are (expand/collapse), not for
// the mirror they live in; the legacy key is read once so remembered open/
// closed choices survive the rename.
const SECTION_STATE_KEY = 'paint:disclosure-sections';
const LEGACY_SECTION_STATE_KEY = 'paint:mirror-sections';
// Sections start open so nothing is hidden on first visit; the user's own
// expand/collapse choice is remembered per section id.
const readSectionState = () => {
  try {
    const raw = globalThis.localStorage?.getItem(SECTION_STATE_KEY)
      ?? globalThis.localStorage?.getItem(LEGACY_SECTION_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};
const writeSectionState = (id, open) => {
  try {
    const next = { ...readSectionState(), [id]: open };
    globalThis.localStorage?.setItem(SECTION_STATE_KEY, JSON.stringify(next));
  } catch { /* remembering the layout is best-effort */ }
};
// Open by default; an explicit remembered choice wins. Mirror descriptors may
// carry a legacy `open` flag, but the product rule is "nothing hidden on first
// visit", so only the user's own choice overrides the default. Exported because
// the Sidebar builds the same disclosure pattern for its settings panels.
export const applySectionState = (details, id) => {
  const remembered = readSectionState()[id];
  details.open = typeof remembered === 'boolean' ? remembered : true;
  details.addEventListener('toggle', () => writeSectionState(id, details.open));
  return details;
};
const chevron = () => {
  const c = mk('span', 'menu-arrow', '▾');
  c.setAttribute('aria-hidden', 'true');
  return c;
};
const SECTION_ICON_PATHS = Object.freeze({
  'undo-redo': 'M7 7 3 10l4 3M3 10h8a5 5 0 0 1 5 5M13 7l4-4m0 0h-4m4 0v4',
  document: 'M5 2h7l4 4v12H5zM12 2v5h4M8 11h5M8 14h5',
  export: 'M10 13V3m0 0L6 7m4-4 4 4M4 12v5h12v-5',
  drawing: 'm4 14 9-9 3 3-9 9-4 1zM12 6l3 3',
  advanced: 'M4 4h5v5H4zM11 4h5v5h-5zM4 11h5v5H4zM11 11h5v5h-5z',
  opacity: 'M10 2s-6 6-6 10a6 6 0 0 0 12 0c0-4-6-10-6-10Z',
  adjustments: 'M3 5h14M3 10h14M3 15h14M7 3v4m5 1v4m-4 1v4',
  actions: 'M5 4h10v13H5zM8 2h4M8 8h4M8 11h4M8 14h4',
  extras: 'M10 2v4m0 8v4M2 10h4m8 0h4M4.3 4.3l2.8 2.8m5.8 5.8 2.8 2.8m0-11.4-2.8 2.8m-5.8 5.8-2.8 2.8',
  history: 'M3 5v4h4M4 9a6 6 0 1 1 1 5m5-5V5m0 4 3 2',
  'all-shapes': 'M3 4h6v5H3zM12 3l5 7h-10zM6 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  favorites: 'm10 2 2.3 5 5.5.7-4 3.9 1 5.5-4.8-2.7-4.8 2.7 1-5.5-4-3.9 5.5-.7z',
  size: 'M3 7V3h4m6 0h4v4m0 6v4h-4m-6 0H3v-4',
  'select-resize': 'M3 7V3h4m6 0h4v4m0 6v4h-4m-6 0H3v-4M7 10h6m-3-3v6',
  'selection-properties': 'M3 3h14v14H3zM6 7h8M6 10h8M6 13h5',
});
const sectionTitleNode = (section) => {
  const wrapper = mk('span', 'disclosure-heading');
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 20 20');
  icon.setAttribute('class', 'icon size4 disclosure-icon');
  icon.setAttribute('aria-hidden', 'true');
  const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  iconPath.setAttribute('d', SECTION_ICON_PATHS[section.icon || section.id] || SECTION_ICON_PATHS.advanced);
  iconPath.setAttribute('fill', 'none');
  iconPath.setAttribute('stroke', 'currentColor');
  iconPath.setAttribute('stroke-linecap', 'round');
  icon.append(iconPath);
  const span = mk('span', '', section.titleKey ? t(section.titleKey) : String(section.title ?? section.id));
  wrapper.append(icon, runtimeKey(span, section.titleKey));
  return wrapper;
};
const buildItems = (section, hooks) => {
  const list = mk('div', 'mirror-items');
  const syncers = [];
  const disposers = [];
  (section.items || []).forEach((item) => {
    if (!item) return;
    if (item.kind === 'custom' && isFn(item.mount)) {
      const host = mk('div', 'mirror-custom');
      const dispose = item.mount(host);
      if (isFn(dispose)) disposers.push(dispose);
      list.append(host);
      return;
    }
    const built = item.kind === 'toggle' ? buildToggle(item) : item.kind === 'slider' ? buildSlider(item) : buildAction(item, hooks?.onAction);
    syncers.push(built.sync);
    list.append(built.node);
  });
  return { list, syncers, disposers };
};
const buildSection = (section, hooks) => {
  const details = mk('details', 'disclosure-section');
  details.dataset.tag = `sidebar-mirror-${section.id}`;
  applySectionState(details, section.id);
  const summary = mk('summary', 'disclosure-title');
  summary.append(chevron(), sectionTitleNode(section));
  details.append(summary);
  const { list, syncers, disposers } = buildItems(section, hooks);
  details.append(list);
  return { node: details, syncers, disposers };
};
// Tabs layout: one tab strip plus exclusive panels. Keyboard follows the
// roving-tabindex pattern and mirrors the arrow direction under RTL.
const MIRROR_TAB_STATE_KEY = 'paint:mirror-tabs';
const readMirrorTabState = () => {
  try {
    const state = JSON.parse(globalThis.localStorage?.getItem(MIRROR_TAB_STATE_KEY) || '{}');
    return state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  } catch {
    return {};
  }
};
const writeMirrorTabState = (layoutKey, sectionId) => {
  try {
    globalThis.localStorage?.setItem(MIRROR_TAB_STATE_KEY, JSON.stringify({
      ...readMirrorTabState(),
      [layoutKey]: sectionId,
    }));
  } catch { /* remembering the selected tab is best-effort */ }
};
const buildTabs = (sections, hooks, layoutKey) => {
  const tablist = mk('div', 'mirror-tablist');
  tablist.setAttribute('role', 'tablist');
  const nodes = [tablist];
  const syncers = [];
  const disposers = [];
  const tabButtons = [];
  const panels = [];
  const activate = (index, remember = true) => {
    tabButtons.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (panels[i]) panels[i].hidden = !active;
    });
    if (remember && sections[index]) writeMirrorTabState(layoutKey, sections[index].id);
  };
  sections.forEach((section, index) => {
    const tab = mk('button', 'mirror-tab');
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.dataset.tag = `sidebar-mirror-tab-${section.id}`;
    tab.id = `sidebar-mirror-tab-${section.id}`;
    const { list, syncers: itemSyncers, disposers: itemDisposers } = buildItems(section, hooks);
    const panel = mk('div', 'disclosure-section mirror-tab-panel');
    panel.dataset.tag = `sidebar-mirror-${section.id}`;
    panel.id = `sidebar-mirror-panel-${section.id}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.append(list);
    tab.setAttribute('aria-controls', panel.id);
    tab.append(sectionTitleNode(section));
    tab.addEventListener('click', () => activate(index));
    tabButtons.push(tab);
    panels.push(panel);
    syncers.push(...itemSyncers);
    disposers.push(...itemDisposers);
    tablist.append(tab);
    nodes.push(panel);
  });
  tablist.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const current = tabButtons.indexOf(document.activeElement);
    if (current < 0) return;
    const rtl = document.documentElement.dir === 'rtl';
    let next = current;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabButtons.length - 1;
    else if (event.key === 'ArrowRight') next = rtl ? current - 1 : current + 1;
    else next = rtl ? current + 1 : current - 1;
    if (next < 0 || next >= tabButtons.length) return;
    event.preventDefault();
    activate(next);
    tabButtons[next].focus();
  });
  const rememberedSection = readMirrorTabState()[layoutKey];
  const rememberedIndex = sections.findIndex((section) => section.id === rememberedSection);
  const initialIndex = rememberedIndex >= 0 ? rememberedIndex : Math.max(0, sections.findIndex((s) => s.open));
  activate(initialIndex, false);
  return { nodes, syncers, disposers };
};
export const createRibbonMirror = ({ descriptor = null, hooks = {} } = {}) => {
  const root = mk('section', 'ribbon-mirror');
  root.dataset.tag = 'sidebar-mirror';
  let syncers = [];
  let disposers = [];
  const disposeItems = () => {
    disposers.forEach((dispose) => {
      try { dispose(); } catch { /* dispose other mounted items */ }
    });
    disposers = [];
  };
  const render = (next = descriptor) => {
    disposeItems();
    root.replaceChildren();
    syncers = [];
    if (!next) return;
    root.dataset.layout = next.layout === 'tabs' ? 'tabs' : 'sections';
    const sections = (next.sections || []).filter(Boolean);
    if (root.dataset.layout === 'tabs') {
      const tabs = buildTabs(sections, hooks, next.key);
      syncers.push(...tabs.syncers);
      disposers.push(...tabs.disposers);
      tabs.nodes.forEach((node) => root.append(node));
    } else {
      sections.forEach((s) => {
        const b = buildSection(s, hooks);
        syncers.push(...b.syncers);
        disposers.push(...b.disposers);
        root.append(b.node);
      });
    }
    if (next.visibility) {
      const block = applySectionState(mk('details', 'disclosure-section mirror-visibility'), 'visibility');
      block.dataset.tag = 'sidebar-mirror-visibility';
      const summary = mk('summary', 'disclosure-title');
      summary.append(chevron(), runtimeKey(mk('span', '', t('ui.mirrorVisibility')), 'ui.mirrorVisibility'));
      block.append(summary, runtimeKey(mk('p', 'mirror-visibility-note', t('ui.mirrorVisibilityNote')), 'ui.mirrorVisibilityNote'));
      root.append(block);
    }
  };
  const sync = () => syncers.forEach((fn) => { try { fn(); } catch { /* keep others */ } });
  render(descriptor);
  return Object.freeze({ element: root, render, sync, destroy: disposeItems });
};
