// js/app/historyControls.js
// History preferences, the save-limit mirrors and history export/clear.
// Phase 3 modularisation: Settings owns the values, this module owns every
// control surface that writes or displays them.
import { t } from '../i18n/messages.js';
import { DEFAULT_SETTINGS, HISTORY_LIMIT_OPTIONS, HISTORY_VIEWS } from '../core/constants.js';

/**
 * @param {object} deps collaborators owned by main.js
 */
export const initHistoryControls = ({
  settingsStore,
  sidebar,
  statusBar,
  dialogService,
  readSettings,
  getHistoryPrefs,
  saveSettings,
  renderSegmentedChoices,
  setLocalizedText,
}) => {
	const syncHistoryControls = (saved) => {
		const prefs = saved
			? { autoSave: saved.historyAutoSave !== false, mode: saved.historyAutoSaveMode === 'close' ? 'lifecycle' : (saved.historyAutoSaveMode || 'lifecycle') }
			: getHistoryPrefs();
		const t1 = document.getElementById('history-auto-save-toggle');
		const t2 = document.getElementById('setting-history-auto-save');
		const m = document.getElementById('setting-history-auto-save-mode');
		const restore = document.getElementById('setting-restore-last-image');
		if (t1) t1.checked = prefs.autoSave;
		if (t2) t2.checked = prefs.autoSave;
		if (m) m.value = prefs.mode;
		if (restore) restore.checked = readSettings().restoreLastImage === true;
		const status = document.getElementById('history-auto-status');
		const modeKeys = { lifecycle: 'ui.autoSaveLifecycle', all: 'ui.allAutomaticEvents', manual: 'ui.onlyManualShort' };
		setLocalizedText(status, prefs.autoSave ? (modeKeys[prefs.mode] ?? null) : 'ui.off');
		renderSegmentedChoices();
	}

	const syncHistoryLimitSelect = (value) => {
		const sidebarSel = document.getElementById('history-save-limit');
		const settingsSel = document.getElementById('setting-history-save-limit');
		if (sidebarSel) sidebarSel.value = String(value);
		if (settingsSel) settingsSel.value = String(value);
		const limitStatus = document.getElementById('history-limit-status');
		// Concise one-line summary (Phase 2 step-04): the row shows the plain
		// number; the Settings dialog keeps the worded "50 images" labels.
		if (value > 0) {
			if (limitStatus) {
				limitStatus.textContent = String(value);
				limitStatus.removeAttribute('data-i18n-runtime');
			}
		} else {
			setLocalizedText(limitStatus, 'ui.off');
		}
		renderSegmentedChoices();
	}

	const exportHistoryItem = async (session, index) => {
		const stamp = session.timestamp
			? new Date(session.timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19)
			: 'session-step';
		const name = `history-${index + 1}-${stamp}.png`;
		const a = document.createElement('a');
		a.href = session.dataUrl;
		a.download = name;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	const exportSessionEntry = async (entry, index) => {
		const a = document.createElement('a');
		a.href = entry.dataUrl;
		a.download = `session-${index + 1}.png`;
		document.body.appendChild(a);
		a.click();
		a.remove();
	}

	const exportAllHistory = async () => {
		const sessionView = sidebar.historyView === HISTORY_VIEWS.session;
		if (sessionView) {
			const entries = sidebar.historyManager?.getSessionEntries?.() || [];
			if (!entries.length) {
				statusBar.flash(t('status.noSessionStepsToExport'));
				return;
			}
			for (let i = 0; i < entries.length; i += 1) {
				await exportSessionEntry(entries[i], i);
				await new Promise((resolve) => setTimeout(resolve, 250));
			}
			statusBar.flash(t('status.exportedSessionImages', { count: entries.length }));
			return;
		}
		const sessions = await sidebar.globalHistory.getSessions();
		if (!sessions.length) {
			statusBar.flash(t('status.noHistoryToExport'));
			return;
		}
		// Preferred: let the user pick a folder and write every image into it.
		if (window.showDirectoryPicker) {
			try {
				const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
				for (let i = 0; i < sessions.length; i += 1) {
					const stamp = new Date(sessions[i].timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19);
					const name = `history-${sessions.length - i}-${stamp}.png`;
					const blob = await (await fetch(sessions[i].dataUrl)).blob();
					const handle = await dir.getFileHandle(name, { create: true });
					const writable = await handle.createWritable();
					await writable.write(blob);
					await writable.close();
				}
				statusBar.flash(`Exported ${sessions.length} images to folder`);
				return;
			} catch (err) {
				if (err && err.name === 'AbortError') return;
				console.warn('Directory export failed, falling back to downloads:', err);
			}
		}
		// Fallback: sequential downloads (newest first, matching grid order).
		for (let i = 0; i < sessions.length; i += 1) {
			await exportHistoryItem(sessions[i], sessions.length - 1 - i);
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
		statusBar.flash(t('status.exportedImages', { count: sessions.length }));
	}

	// Phase 3 / step-01: Settings is the only owner of the save limit. Both selects
	// and the sidebar summary are views; IndexedDB keeps only the enforcement copy.
	const applyHistoryLimit = (val) => {
		const parsed = parseInt(val, 10);
		const safe = HISTORY_LIMIT_OPTIONS.includes(parsed)
			? parsed
			: Number(readSettings().historyLimit ?? DEFAULT_SETTINGS.historyLimit);
		settingsStore.set({ historyLimit: safe });
		syncHistoryLimitSelect(safe);
		if (sidebar?.globalHistory?.db) {
			sidebar.globalHistory.saveSettings(safe, safe > 0);
		}
	}

	// Startup restore + one-time migration: when the store still holds the default
	// and IndexedDB has another valid limit (someone changed it before the setting
	// existed), adopt the IndexedDB value so their choice is not lost.
	const restoreHistoryLimit = () => {
		const stored = Number(readSettings().historyLimit);
		const indexed = Number(sidebar.globalHistory.maxHistory);
		const migrateFromIndexedDb = stored === DEFAULT_SETTINGS.historyLimit
			&& HISTORY_LIMIT_OPTIONS.includes(indexed)
			&& indexed !== stored;
		const limit = migrateFromIndexedDb
			? indexed
			: (HISTORY_LIMIT_OPTIONS.includes(stored) ? stored : DEFAULT_SETTINGS.historyLimit);
		if (limit !== stored) settingsStore.set({ historyLimit: limit });
		syncHistoryLimitSelect(limit);
		if (limit !== indexed) sidebar.globalHistory.saveSettings(limit, limit > 0);
	}

	const applyHistoryState = () => {
		const { autoSave } = getHistoryPrefs();
		statusBar?.flash?.(t(autoSave ? 'status.historyAutoSaveOn' : 'status.historyAutoSaveOff'));
		syncHistoryControls();
	}

		// ---------- control wiring ----------
	const autoSaveToggle = document.getElementById('history-auto-save-toggle');
	const settingAutoSave = document.getElementById('setting-history-auto-save');
	const settingAutoMode = document.getElementById('setting-history-auto-save-mode');
	const historyLimitSel = document.getElementById('history-save-limit');
	const settingLimit = document.getElementById('setting-history-save-limit');

	const persistHistoryPrefs = () => {
		const state = {
			historyAutoSave: autoSaveToggle ? autoSaveToggle.checked : (settingAutoSave ? settingAutoSave.checked : true),
			historyAutoSaveMode: settingAutoMode ? settingAutoMode.value : 'all',
		};
		try {
			settingsStore.set(state);
		} catch (err) {
			console.warn('Unable to save history prefs:', err);
		}
	}

	const onAutoSaveChange = (event) => {
		const enabled = event?.target?.checked ?? settingAutoSave?.checked ?? autoSaveToggle?.checked ?? true;
		if (settingAutoSave) settingAutoSave.checked = enabled;
		if (autoSaveToggle) autoSaveToggle.checked = enabled;
		persistHistoryPrefs();
		applyHistoryState();
		saveSettings();
	};
	autoSaveToggle?.addEventListener('change', onAutoSaveChange);
	settingAutoSave?.addEventListener('change', onAutoSaveChange);
	settingAutoMode?.addEventListener('change', () => {
		persistHistoryPrefs();
		syncHistoryControls();
		renderSegmentedChoices();
	});
	document.getElementById('setting-restore-last-image')?.addEventListener('change', saveSettings);
	historyLimitSel?.addEventListener('change', (e) => applyHistoryLimit(e.target.value));
	settingLimit?.addEventListener('change', (e) => applyHistoryLimit(e.target.value));

		// ---------- export / clear wiring ----------
	document.getElementById('history-export-all-btn')?.addEventListener('click', () => exportAllHistory());
	window.addEventListener('paint:history-export-item', (e) => {
		exportHistoryItem(e.detail.session, e.detail.index);
		statusBar.flash(t('status.historySaved'));
	});
	document.getElementById('settings-history-export-all')?.addEventListener('click', () => exportAllHistory());
	document.getElementById('settings-history-clear')?.addEventListener('click', async () => {
		const confirmed = await dialogService.confirm({
			title: t('history.clearTitle'),
			message: t('history.clearConfirm'),
			confirmLabel: t('history.clearTitle'),
			danger: true,
		});
		if (!confirmed) return;
		await sidebar.globalHistory.clearAll();
		if (sidebar.activeTab === HISTORY_VIEWS.history) await sidebar.refreshHistory();
		statusBar.flash(t('status.historyCleared'));
	});

  return Object.freeze({
    syncHistoryControls,
    syncHistoryLimitSelect,
    exportAllHistory,
    exportHistoryItem,
    applyHistoryLimit,
    restoreHistoryLimit,
    applyHistoryState,
  });
};
