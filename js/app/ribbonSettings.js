// js/app/ribbonSettings.js
// Settings ▸ Ribbon rows: one visibility checkbox per ribbon group plus the
// Details shortcut into the group panel. Phase 3 modularisation.
import { t } from '../i18n/messages.js';
import { appendDialogIndicator } from '../ui/DialogIndicator.js';

// Stable render order, so the rows do not shuffle when a group is missing.
const RIBBON_GROUP_ORDER = Object.freeze([
  'ribbon-group-file',
  'ribbon-group-clipboard',
  'ribbon-group-image',
  'ribbon-group-tools',
  'ribbon-group-shapes',
  'ribbon-group-colors',
  'ribbon-group-history',
  'ribbon-group-extras',
]);

/** @param {object} deps collaborators owned by main.js */
export const initRibbonSettings = ({ sidebar, saveSettings }) => {
  const syncRibbonSettingsControls = () => {
    document.querySelectorAll('[data-ribbon-group-setting]').forEach((checkbox) => {
      const group = document.querySelector(`.${checkbox.dataset.ribbonGroupSetting}`);
      if (!group) return;
      checkbox.checked = [...group.children]
        .filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
        .some((child) => !child.hidden && child.style.display !== 'none');
    });
  };

  const populateRibbonSettings = () => {
    const container = document.getElementById('ribbon-settings-list');
    if (!container) return;
    container.innerHTML = '';
    const groups = RIBBON_GROUP_ORDER.map((className) => document.querySelector(`.${className}`)).filter(Boolean);
    document.querySelectorAll('.ribbon-group').forEach((groupSection) => {
      if (!groups.includes(groupSection)) groups.push(groupSection);
    });
    groups.forEach((groupSection) => {
      const title = groupSection.querySelector('.ribbon-group-title');
      if (!title) return;
      const groupKey = [...groupSection.classList]
        .find((name) => name.startsWith('ribbon-group-') && name !== 'ribbon-group')
        ?.slice('ribbon-group-'.length);
      if (!groupKey) return;
      const row = document.createElement('div');
      row.className = 'ribbon-setting-row';
      const label = document.createElement('div');
      label.className = 'checkbox-row';
      label.dataset.tag = `ribbon-group-visibility-row-${groupKey}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `ribbon-group-visibility-${groupKey}`;
      checkbox.dataset.tag = checkbox.id;
      const checkboxLabel = document.createElement('label');
      checkboxLabel.htmlFor = checkbox.id;
      checkboxLabel.dataset.tag = `${checkbox.id}-label`;
      checkbox.dataset.ribbonGroupSetting = [...groupSection.classList].find((name) => name.startsWith('ribbon-group-')) || '';
      checkbox.checked = [...groupSection.children]
        .filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
        .some((child) => !child.hidden && child.style.display !== 'none');
      const isExtras = groupSection.classList.contains('ribbon-group-extras');
      if (isExtras) checkbox.disabled = true;
      checkbox.addEventListener('change', () => {
        if (isExtras) return;
        [...groupSection.children]
          .filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
          .forEach((child) => {
            child.hidden = !checkbox.checked;
            child.style.display = checkbox.checked ? '' : 'none';
          });
        const separator = groupSection.nextElementSibling;
        groupSection.hidden = !checkbox.checked;
        if (separator?.classList.contains('separator')) separator.style.display = checkbox.checked ? '' : 'none';
        saveSettings();
      });
      checkboxLabel.textContent = isExtras ? t('ui.settingsAlwaysVisible', { group: title.textContent }) : title.textContent;
      label.append(checkbox, checkboxLabel);
      const details = document.createElement('button');
      details.type = 'button';
      details.className = 'ribbon-setting-details';
      details.dataset.tag = `ribbon-group-details-${groupKey}`;
      details.textContent = t('ui.details');
      appendDialogIndicator(details);
      details.addEventListener('click', () => sidebar.openGroupSettings(groupSection));
      row.append(label, details);
      container.appendChild(row);
    });
  };

  populateRibbonSettings();

  return Object.freeze({ populateRibbonSettings, syncRibbonSettingsControls });
};