// js/app/aboutPanel.js
// Settings ▸ About: version, storage estimates and the release-notes list.
// Phase 3 modularisation: extracted from main.js so the composition root only
// wires it. Storage numbers are browser estimates, never a fixed quota.
import { t } from '../i18n/messages.js';
import { APP_VERSION } from '../version.js';
import { getReleaseNotes } from '../releaseNotes.js';
import { formatUnambiguousDate, formatUnambiguousDateTime } from '../utils/datetime.js';

const normalizeStorageEstimate = (value) => {
  const usage = Number(value?.usage);
  const quota = Number(value?.quota);
  if (!Number.isFinite(usage) || !Number.isFinite(quota) || usage < 0 || quota <= 0 || usage > quota) return null;
  return { usage, quota, checkedAt: Number(value?.checkedAt) || Date.now() };
};

const getStorageEstimate = async () => {
  const estimate = await navigator.storage?.estimate?.();
  return normalizeStorageEstimate({ ...estimate, checkedAt: Date.now() });
};

/** Re-read the estimate every time the tab opens; labels stay honest about it. */
const MB = 1024 * 1024;
const formatBytes = (bytes) => {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return 'Unavailable';
  const units = value >= 1024 ** 3 ? ['GiB', 1024 ** 3]
    : value >= MB ? ['MiB', MB]
    : value >= 1024 ? ['KiB', 1024]
    : ['B', 1];
  return `${(value / units[1]).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${units[0]}`;
};
const formatQuota = (bytes) => {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return 'Unavailable';
  const GiB = 1024 ** 3;
  if (value >= GiB) return `≈${(value / GiB).toLocaleString('en-US', { maximumFractionDigits: 0 })} GiB`;
  return formatBytes(value);
};

export const initAboutPanel = () => {
  // Version and activity are static facts: publish them from the first paint so
  // the panel never shows an empty or stale version just because nobody opened
  // the About tab yet.
  const renderAboutIdentity = () => {
    const version = document.getElementById('about-version');
    const activity = document.getElementById('about-activity');
    if (version) version.textContent = APP_VERSION;
    if (activity) activity.textContent = formatUnambiguousDateTime(new Date());
  };

  const updateAboutStats = async () => {
    const loading = document.getElementById('about-loading-state');
    const aboutValues = document.querySelectorAll('[data-about-value]');
    if (loading) loading.hidden = false;
    aboutValues.forEach((element) => element.setAttribute('aria-busy', 'true'));
    renderAboutIdentity();
    try {
      const estimate = await getStorageEstimate();
      const usageBytes = estimate?.usage || 0;
      const quotaBytes = estimate?.quota || 0;
      const storage = document.getElementById('about-storage');
      if (storage) storage.textContent = estimate ? formatBytes(usageBytes) : 'Unavailable';
      const quotaEl = document.getElementById('about-storage-quota');
      if (quotaEl) quotaEl.textContent = estimate ? formatQuota(quotaBytes) : 'Unavailable';
      const fill = document.getElementById('about-storage-bar-fill');
      const usageLabel = document.getElementById('about-storage-usage-label');
      if (fill) {
        let pct = 0;
        if (estimate && quotaBytes > 0 && usageBytes > 0) {
          pct = Math.min(100, Math.max(1, Math.ceil((usageBytes / quotaBytes) * 100)));
        }
        const viewPct = pct < 50 ? pct + 2 : pct; // keep the fill bar visible even at low usage
        fill.style.width = `${viewPct}%`;
        if (usageLabel) {
          const ratio = estimate && quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;
          const percent = ratio > 0 && `~${String(Math.ceil(ratio))}`;
          usageLabel.textContent = estimate ? t('ui.usagePercent', { percent }) : t('ui.usage');
        }
      }
    } catch {
      const storage = document.getElementById('about-storage');
      if (storage) storage.textContent = 'Unavailable';
      const quotaEl = document.getElementById('about-storage-quota');
      if (quotaEl) quotaEl.textContent = 'Unavailable';
      const usageLabel = document.getElementById('about-storage-usage-label');
      if (usageLabel) usageLabel.textContent = t('ui.usage');
    } finally {
      aboutValues.forEach((element) => element.removeAttribute('aria-busy'));
      if (loading) loading.hidden = true;
    }
  };

  const renderReleaseNotes = () => {
    const host = document.getElementById('release-notes-list');
    if (!host) return;
    host.innerHTML = '';
    for (const note of getReleaseNotes()) {
      const card = document.createElement('div');
      card.className = 'release-note-card';
      const head = document.createElement('div');
      head.className = 'release-note-head';
      const ver = document.createElement('strong');
      ver.textContent = `v${note.version}`;
      head.appendChild(ver);
      if (note.date) {
        const date = document.createElement('span');
        date.className = 'release-note-date';
        date.textContent = /^\d{4}-\d{2}-\d{2}$/.test(note.date)
          ? formatUnambiguousDate(new Date(`${note.date}T00:00:00`))
          : note.date;
        head.appendChild(date);
      }
      const list = document.createElement('ul');
      for (const key of note.highlightKeys) {
        const li = document.createElement('li');
        li.textContent = t(key);
        list.appendChild(li);
      }
      card.append(head, list);
      host.appendChild(card);
    }
  };

  const refreshAboutOnLocaleChange = () => {
    if (!document.querySelector('[data-settings-panel="about"]')?.hidden) void updateAboutStats();
  };
  const refreshReleaseNotesOnLocaleChange = () => renderReleaseNotes();

  document.documentElement?.addEventListener('paint:locale-change', refreshAboutOnLocaleChange);
  document.documentElement?.addEventListener('paint:locale-change', refreshReleaseNotesOnLocaleChange);
  renderAboutIdentity();
  renderReleaseNotes();

  return Object.freeze({ updateAboutStats, renderReleaseNotes });
};