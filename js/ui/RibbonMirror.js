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
  input.min = String(item.min ?? 0);
  input.max = String(item.max ?? 100);
  input.value = String(Number(item.get?.()) || 0);
  input.setAttribute('aria-label', localized(item, 'Value'));
  const val = mk('span', 'mirror-slider-value', `${input.value}${item.unit ?? ''}`);
  input.addEventListener('input', () => { val.textContent = `${input.value}${item.unit ?? ''}`; item.set?.(Number(input.value)); });
  row.append(label, input, val);
  return { node: row, sync: () => { input.value = String(Number(item.get?.()) || 0); val.textContent = `${input.value}${item.unit ?? ''}`; } };
};
const chevron = () => {
  const c = mk('span', 'menu-arrow', '▾');
  c.setAttribute('aria-hidden', 'true');
  return c;
};
const sectionTitleNode = (section) => {
  const span = mk('span', '', section.titleKey ? t(section.titleKey) : String(section.title ?? section.id));
  return runtimeKey(span, section.titleKey);
};
const buildItems = (section, hooks) => {
  const list = mk('div', 'mirror-items');
  const syncers = [];
  (section.items || []).forEach((item) => {
    if (!item) return;
    if (item.kind === 'custom' && isFn(item.mount)) {
      const host = mk('div', 'mirror-custom');
      item.mount(host);
      list.append(host);
      return;
    }
    const built = item.kind === 'toggle' ? buildToggle(item) : item.kind === 'slider' ? buildSlider(item) : buildAction(item, hooks?.onAction);
    syncers.push(built.sync);
    list.append(built.node);
  });
  return { list, syncers };
};
const buildSection = (section, hooks) => {
  const details = mk('details', 'mirror-section');
  details.dataset.tag = `sidebar-mirror-${section.id}`;
  if (section.open) details.open = true;
  const summary = mk('summary', 'mirror-section-title');
  summary.append(chevron(), sectionTitleNode(section));
  details.append(summary);
  const { list, syncers } = buildItems(section, hooks);
  details.append(list);
  return { node: details, syncers };
};
// Tabs layout: one tab strip plus exclusive panels. Keyboard follows the
// roving-tabindex pattern and mirrors the arrow direction under RTL.
const buildTabs = (sections, hooks) => {
  const tablist = mk('div', 'mirror-tablist');
  tablist.setAttribute('role', 'tablist');
  const nodes = [tablist];
  const syncers = [];
  const tabButtons = [];
  const panels = [];
  const activate = (index) => {
    tabButtons.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (panels[i]) panels[i].hidden = !active;
    });
  };
  sections.forEach((section, index) => {
    const tab = mk('button', 'mirror-tab');
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.id = `sidebar-mirror-tab-${section.id}`;
    const { list, syncers: itemSyncers } = buildItems(section, hooks);
    const panel = mk('div', 'mirror-section mirror-tab-panel');
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
  activate(Math.max(0, sections.findIndex((s) => s.open)));
  return { nodes, syncers };
};
export const createRibbonMirror = ({ descriptor = null, hooks = {} } = {}) => {
  const root = mk('section', 'ribbon-mirror');
  root.dataset.tag = 'sidebar-mirror';
  let syncers = [];
  const render = (next = descriptor) => {
    root.replaceChildren();
    syncers = [];
    if (!next) return;
    root.dataset.layout = next.layout === 'tabs' ? 'tabs' : 'sections';
    const sections = (next.sections || []).filter(Boolean);
    if (root.dataset.layout === 'tabs') {
      const tabs = buildTabs(sections, hooks);
      syncers.push(...tabs.syncers);
      tabs.nodes.forEach((node) => root.append(node));
    } else {
      sections.forEach((s) => {
        const b = buildSection(s, hooks);
        syncers.push(...b.syncers);
        root.append(b.node);
      });
    }
    if (next.visibility) {
      const block = mk('details', 'mirror-section mirror-visibility');
      block.dataset.tag = 'sidebar-mirror-visibility';
      const summary = mk('summary', 'mirror-section-title');
      summary.append(chevron(), runtimeKey(mk('span', '', t('ui.mirrorVisibility')), 'ui.mirrorVisibility'));
      block.append(summary, runtimeKey(mk('p', 'mirror-visibility-note', t('ui.mirrorVisibilityNote')), 'ui.mirrorVisibilityNote'));
      root.append(block);
    }
  };
  const sync = () => syncers.forEach((fn) => { try { fn(); } catch { /* keep others */ } });
  render(descriptor);
  return Object.freeze({ element: root, render, sync });
};
