// js/ui/Sidebar.js
import { GlobalHistory } from '../history/GlobalHistory.js';
import { AI_PROVIDERS } from '../ai/AiConnectionStore.js';
import { HISTORY_VIEWS } from '../core/constants.js';
import { createHistoryPanel } from './HistoryPanel.js';
import { applySectionState, createRibbonMirror } from './RibbonMirror.js';
import { colorPalettePreset } from '../utils/color.js';
import { fileMirrorDescriptor } from './mirrors/fileMirror.js';
import { clipboardMirrorDescriptor } from './mirrors/clipboardMirror.js';
import { imageMirrorDescriptor } from './mirrors/imageMirror.js';
import { toolsMirrorDescriptor } from './mirrors/toolsMirror.js';
import { shapesMirrorDescriptor } from './mirrors/shapesMirror.js';
import { colorsMirrorDescriptor } from './mirrors/colorsMirror.js';
import { createExtrasMirrorDescriptor } from './mirrors/extrasMirror.js';
import { historyMirrorDescriptor } from './mirrors/historyMirror.js';
import { t } from '../i18n/messages.js';
import { formatUnambiguousDate, formatUnambiguousTime } from '../utils/datetime.js';

const getHistoryPreviewEntry = (entry) => entry?._sourceEntry || entry;
const getHistoryPreviewSource = (entry) => {
	const sourceEntry = getHistoryPreviewEntry(entry);
	return sourceEntry?.thumb || sourceEntry?.objectUrl
		|| (!sourceEntry?.pending ? sourceEntry?.dataUrl : '')
		|| sourceEntry?.blob || '';
};
const getHistoryPreviewUrl = (entry) => {
	const source = getHistoryPreviewSource(entry);
	return typeof source === 'string' ? source : '';
};
const getRestoreConfirmOptions = ({ src, alt } = {}) => ({
	title: t('ui.restoreOverrideTitle'),
	message: t('ui.restoreOverrideMessage'),
	confirmLabel: t('ui.restoreOverrideAction'),
	danger: true,
	preview: { src, alt },
});

// Phase 2 step-03: every ribbon group resolves through one descriptor table
// (data-ribbon-key -> RibbonMirror descriptor). The mirror never owns state;
// Sidebar only mounts it and re-syncs it from app events.
// Phase 2 step-04: entries may be factories so a group can receive Sidebar's
// deep-link callbacks (Extras -> History views) without a second renderer.
const MIRROR_DESCRIPTORS = Object.freeze({
  file: fileMirrorDescriptor,
  clipboard: clipboardMirrorDescriptor,
  image: imageMirrorDescriptor,
  tools: ({ brushState, getPrimaryColor, setPrimaryColor, getPalette }) => toolsMirrorDescriptor({
    brushState,
    getPrimaryColor,
    setPrimaryColor,
    getPalette,
  }),
  shapes: shapesMirrorDescriptor,
  colors: colorsMirrorDescriptor,
  extras: createExtrasMirrorDescriptor,
  history: historyMirrorDescriptor,
});

export class Sidebar {
	constructor({ canvasManager, statusBar, palette, aiCommandService = null, dialogService, aiConnectionStore = null, historyManager = null, brushState = null }) {
		this.canvasManager = canvasManager;
		this.brushState = brushState;
		this.historyManager = historyManager;
		this.statusBar = statusBar;
		this.palette = palette;
		this.dialogService = dialogService;

		this.sidebar = document.getElementById('right-sidebar');
		this.title = document.getElementById('sidebar-title');
		this.closeBtn = document.getElementById('sidebar-close');

		this.historyContent = document.getElementById('sidebar-history-content');
		this.historyGrid = document.getElementById('history-grid');
		this._historyItemsByKey = new Map();
		this.historyGrid?.addEventListener('click', (event) => {
			void this._handleHistoryItemClick(event);
		});
		this.saveLimitSelect = document.getElementById('history-save-limit');
		this.historyUndoBtn = document.getElementById('history-undo-btn');
		this.historyRedoBtn = document.getElementById('history-redo-btn');
		this._returnFocusTo = null;
		this._openHistoryPreferences = null;
		this.clearBtn = document.getElementById('history-clear-btn');
		this.saveToHistoryBtn = document.getElementById('history-save-current-btn');

		this.aiContent = document.getElementById('sidebar-ai-content');
		this.aiMessages = document.getElementById('ai-chat-messages');
		this.aiInput = document.getElementById('ai-chat-input');
		this.aiSend = document.getElementById('ai-chat-send');
		this.aiActions = document.getElementById('ai-chat-actions');
		this.aiActions?.addEventListener('click', (event) => this._handleAiActionClick(event));
		this.aiCommandService = aiCommandService;
		this.aiConnectionStore = aiConnectionStore;
		this.aiProviderSelect = document.getElementById('ai-provider-select');
		this.aiConnectButton = document.getElementById('ai-connect-button');
		this.aiConnectionStatus = document.getElementById('ai-connection-status');
		this.aiConnectionDialog = document.getElementById('ai-connection-dialog');
		this.aiConnectionDescription = document.getElementById('ai-connection-description');
		this.aiProviderLink = document.getElementById('ai-provider-link');
		this.aiCopyImageButton = document.getElementById('ai-copy-current-image');
		this.historyPanel = createHistoryPanel({
			root: this.sidebar,
			onViewChange: (view) => {
				this.historyView = view;
				if (this.activeTab === HISTORY_VIEWS.history) void this.refreshHistory();
			},
		});
		this.historyView = this.historyPanel.getView();
		this.historyPanel.bind();

		this.groupSettingsContent = document.getElementById('sidebar-group-settings');
		this.groupSettingsContainer = document.getElementById('group-settings-container');
		this.ribbonMirror = null;
		this.ribbonMirrorTitle = null;
		// Palette settings panel hooks: the refresh closure re-renders the
		// settings grids after any palette write, the picker element tracks the
		// extended swatch grid so its selected outline follows the primary.
		this._palettePanelRefresh = null;
		this._palettePickerEl = null;
		this.globalHistory = new GlobalHistory();
		this.activeTab = null;

		// Mirror settings sliders follow the shared color state; undo/redo
		// disabled parity is re-run from the history callback in main.js.
		window.addEventListener('paint:primary-color-change', () => {
			this.syncRibbonMirror();
			this._syncPalettePicker();
		});
		// Palette slot writes (ribbon context menu, presets, custom grid) rebuild
		// the open Colors settings panel from the same source of truth.
		window.addEventListener('paint:palette-change', () => this._palettePanelRefresh?.());

		// Initialization state tracking for race condition prevention
		this._initComplete = false;
		this._initPromise = null;

		// Restore sidebar state IMMEDIATELY before async init
		this._restoreSidebarState();
		this._restoreSidebarWidth();

		// Restore ribbon button visibility state IMMEDIATELY
		this._restoreRibbonButtonState();

		// Start initialization and track completion
		this._initPromise = this.init();
	}

	async init() {
		try {
			await this.globalHistory.init();
		} catch (error) {
			this.globalHistory.historyEnabled = false;
			console.warn('Global history unavailable:', error);
		}

		this.saveLimitSelect.value = this.globalHistory.historyEnabled ? this.globalHistory.maxHistory.toString() : "0";

		// History save limit dropdown: change setting, don't auto-clear
		this.saveLimitSelect.addEventListener('change', async (e) => {
			const val = parseInt(e.target.value, 10);
			const enabled = val > 0;
			await this.globalHistory.saveSettings(val, enabled);
			// Use retry logic to ensure render completes
			if (this.activeTab === HISTORY_VIEWS.history) {
				await this._loadHistoryWithRetry();
			}
		});

		// History sub-tabs: History (IndexedDB) + Session (sessionStorage-backed)
		this._syncHistoryActionLabels();

		// Clear button clears whichever view is active (labels follow the tab).
		this.clearBtn.addEventListener('click', async () => {
			if (this.historyView === HISTORY_VIEWS.session) {
				const confirmed = await this.dialogService.confirm({
					title: 'Clear session',
					message: 'Delete all session steps for this browser tab? Saved history is kept.',
					confirmLabel: 'Clear session',
					danger: true,
				});
				if (confirmed) {
					this.historyManager?.clearSession();
					if (this.activeTab === HISTORY_VIEWS.history) await this._loadHistoryWithRetry();
					this.statusBar?.flash?.('Session cleared');
				}
				return;
			}
			const confirmed = await this.dialogService.confirm({
				title: 'Clear history',
				message: 'Are you sure you want to permanently delete all saved history? This cannot be undone.',
				confirmLabel: 'Clear history',
				danger: true,
			});
			if (confirmed) {
				await this.globalHistory.clearAll();
				// Use retry logic to ensure render completes
				if (this.activeTab === HISTORY_VIEWS.history) {
					await this._loadHistoryWithRetry();
				}
				this.statusBar?.flash?.('History cleared');
			}
		});

		// Save current paint to the ACTIVE view (history or session snapshot).
		if (this.saveToHistoryBtn) {
			this.saveToHistoryBtn.addEventListener('click', async () => {
				if (this.historyView === HISTORY_VIEWS.session) {
					this.historyManager?.snapshot?.({ force: true });
					await this.historyManager?.waitForPendingSnapshots?.();
					this.historyManager?.persistSession?.();
					await this.refreshHistory();
					this.statusBar?.flash?.('Saved to session');
					return;
				}
				await this.saveCurrentToHistory();
				this.statusBar?.flash?.('Saved to history');
			});
		}

		this.closeBtn.addEventListener('click', () => this.hide());

		this.aiSend.addEventListener('click', () => this.handleAiSubmit());
		this.aiInput.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') this.handleAiSubmit();
		});

		this._bindResizer();
		this._bindAiConnectionControls();
		this._renderAiActions();

		// Mark initialization as complete
		this._initComplete = true;
	}

	async finishInit() {
		await this._waitForInit();

		if (this.activeTab === HISTORY_VIEWS.history && this.globalHistory.db) {
			await this._loadHistoryWithRetry();
		}
	}

	async resetSettings() {
		await this._waitForInit();
		return this.globalHistory.resetSettings();
	}

	setAiCommandService(service) {
		this.aiCommandService = service;
		this._renderAiActions();
	}

	_bindAiConnectionControls() {
		if (!this.aiProviderSelect || !this.aiConnectionStore) return;
		this.aiProviderSelect.innerHTML = '';
		AI_PROVIDERS.forEach(({ id, label }) => {
			const option = document.createElement('option');
			option.value = id;
			option.textContent = label;
			this.aiProviderSelect.appendChild(option);
		});
		const render = () => {
			const state = this.aiConnectionStore.getState();
			this.aiProviderSelect.value = state.provider;
			if (state.provider === 'local') {
				this.aiConnectionStatus.textContent = 'Ready: local actions only';
				this.aiConnectButton.textContent = 'Connected';
				this.aiConnectButton.disabled = true;
			} else {
				this.aiConnectionStatus.textContent = 'Use the provider website; no credentials are stored here';
				this.aiConnectButton.textContent = 'Open provider';
				this.aiConnectButton.disabled = false;
			}
		};
		this.aiProviderSelect.addEventListener('change', (event) => {
			this.aiConnectionStore.setProvider(event.target.value);
			render();
		});
		this.aiConnectButton?.addEventListener('click', () => {
			this._openAiConnectionDialog();
		});
		this.aiCopyImageButton?.addEventListener('click', () => this._copyCurrentImageForAi());
		render();
	}

	_openAiConnectionDialog() {
		if (!this.aiConnectionDialog || this.aiProviderSelect.value === 'local') return;
		const provider = AI_PROVIDERS.find(({ id }) => id === this.aiProviderSelect.value);
		this.aiConnectionDialog.querySelector('[data-ai-provider-name]')?.replaceChildren(provider?.label || 'AI provider');
		this.aiConnectionDescription.textContent = `Open ${provider?.label || 'the AI provider'} in its official website, sign in there, and upload the image yourself. Paint does not receive or store your login details.`;
		this.aiProviderLink.href = provider?.url || '#';
		this.aiProviderLink.textContent = `Open ${provider?.label || 'provider'} website`;
		this.aiCopyImageButton.disabled = false;
		this.aiConnectionDialog.showModal();
		this.aiProviderLink.focus();
	}

	async _copyCurrentImageForAi() {
		try {
			const blob = await this.canvasManager.toBlob('image/png');
			if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
				this.aiConnectionDescription.textContent = 'Image clipboard is unavailable in this browser. Export the image and upload it on the provider website.';
				return;
			}
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
			this.aiConnectionDescription.textContent = 'Current image copied. Open the provider website and paste it into the chat.';
		} catch (error) {
			console.warn('Unable to copy current image for AI:', error);
			this.aiConnectionDescription.textContent = 'The image could not be copied. Export it and upload it on the provider website.';
		}
	}

	_renderAiActions() {
		if (!this.aiActions) return;
		this.aiActions.innerHTML = '';
		const actions = this.aiCommandService?.getQuickActions?.() || [];
		actions.forEach(({ id, label, command }) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'ai-quick-action';
			button.dataset.aiCommand = command;
			button.dataset.aiCommandId = id;
			button.textContent = label;
			button.title = `Run ${command}`;
			this.aiActions.appendChild(button);
		});
	}

	_handleAiActionClick(event) {
		const button = event.target.closest?.('button[data-ai-command]');
		if (!button || !this.aiActions.contains(button)) return;
		this.handleAiSubmit(button.dataset.aiCommand);
	}

	// Action buttons follow the active view: Clear/Save/Export say exactly
	// which store they touch (History = IndexedDB, Session = browser tab).
	_syncHistoryActionLabels() {
		this.historyPanel?.sync();
	}

	async _loadHistoryWithRetry() {
		// Session view has no IDB count to converge on - render once directly.
		if (this.historyView === HISTORY_VIEWS.session) {
			await this.refreshHistory();
			return;
		}
		const maxRetries = 5;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			const expectedCount = (await this.globalHistory.getSessions()).length;
			if (attempt === 0 && expectedCount > 0) {
				this.historyGrid.innerHTML = '<div class="history-loading">Loading history...</div>';
			}

			const renderedCount = await this.refreshHistory();
			if (renderedCount === expectedCount) {
				return;
			}

			if (attempt < maxRetries - 1) {
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		}
	}

	/**
	 * Wait for async initialization to complete
	 * Prevents race condition where finishInit runs before init completes
	 * @returns {Promise<void>}
	 */
	async _waitForInit() {
		if (this._initComplete) {
			return;
		}

		if (this._initPromise) {
			await this._initPromise;
			return;
		}

		return new Promise((resolve) => {
			const checkInit = setInterval(() => {
				if (this._initComplete) {
					clearInterval(checkInit);
					resolve();
				}
			}, 10);

			setTimeout(() => {
				clearInterval(checkInit);
				console.warn('Sidebar initialization timed out');
				resolve();
			}, 5000);
		});
	}

	async saveCurrentToHistory() {
		if (!this.globalHistory.historyEnabled) return;
		const blob = await this.canvasManager.toBlob('image/png');
		const width = Number(this.canvasManager.canvas.width);
		const height = Number(this.canvasManager.canvas.height);

		const dataUrl = await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result);
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(blob);
		});

		await this.saveDataUrlToHistory(dataUrl, width, height);
		// beforeunload also places a synchronous fallback in localStorage. If the
		// IndexedDB write won the race, consume that fallback to avoid a duplicate
		// history image on the next refresh.
		try {
			const pending = JSON.parse(localStorage.getItem('paint:pending-history-save') || 'null');
			if (pending?.dataUrl === dataUrl) localStorage.removeItem('paint:pending-history-save');
		} catch { }
	}

	async saveDataUrlToHistory(dataUrl, width, height) {
		if (!this.globalHistory.historyEnabled) return;
		// Skip no-change saves: identical pixels to the newest entry are dropped.
		try {
			const latest = (await this.globalHistory.getSessions())[0];
			if (latest && latest.dataUrl === dataUrl) return;
		} catch { }
		await this.globalHistory.addSession(dataUrl, width, height);
		if (this.activeTab === HISTORY_VIEWS.history) this.refreshHistory();
	}

	async flushPendingAutoSave() {
		try {
			const raw = localStorage.getItem('paint:pending-history-save');
			if (!raw) return;
			const pending = JSON.parse(raw);
			if (!pending?.dataUrl) return;
			await this.saveDataUrlToHistory(pending.dataUrl, pending.width, pending.height);
			localStorage.removeItem('paint:pending-history-save');
		} catch (error) {
			console.warn('Unable to flush pending history snapshot:', error);
		}
	}

	toggleHistory() {
		if (this.activeTab === HISTORY_VIEWS.history && this.sidebar.style.display !== 'none') {
			this.hide();
		} else {
			this.showHistory();
		}
	}

	toggleAi() {
		if (this.activeTab === 'ai' && this.sidebar.style.display !== 'none') {
			this.hide();
		} else {
			this.showAi();
		}
	}

	showHistory() {
		this.activeTab = HISTORY_VIEWS.history;
		this.title.setAttribute('data-i18n-ignore', '');
		this.title.textContent = 'History';
		this.historyContent.style.display = 'block';
		this.aiContent.style.display = 'none';
		if (this.groupSettingsContent) this.groupSettingsContent.style.display = 'none';
		this.sidebar.style.display = 'flex';
		this._saveSidebarState();
		// Only refresh if globalHistory is ready
		if (this.globalHistory.db) {
			this.refreshHistory();
		}
	}

	showAi() {
		this.activeTab = 'ai';
		this.title.setAttribute('data-i18n-ignore', '');
		this.title.textContent = 'AI Chat';
		this.historyContent.style.display = 'none';
		this.aiContent.style.display = 'block';
		if (this.groupSettingsContent) this.groupSettingsContent.style.display = 'none';
		this.sidebar.style.display = 'flex';
		this._saveSidebarState();
	}

	// Phase 2 step-03 migration: replaces the legacy title-string group builder.
	// The ribbon group section is the only input; the title and mirror
	// descriptor resolve from it (data-ribbon-key -> descriptor table).
	openGroupSettings(groupSection, { remember = true } = {}) {
		if (!this.groupSettingsContent || !groupSection) return;
		const titleText = groupSection.querySelector('.ribbon-group-title')?.textContent ?? '';
		// Stable key: the visible title is localised, so it cannot identify the
		// panel across languages (or across a renamed group).
		const mirrorKey = groupSection.dataset?.ribbonKey
			|| [...groupSection.classList].find((name) => name.startsWith('ribbon-group-'))?.slice('ribbon-group-'.length)
			|| titleText.trim();
		this.activeTab = `group:${mirrorKey}`;
		// The header must always describe the panel that is actually visible. The
		// static `data-i18n` in the markup would otherwise re-assert the generic
		// "Sidebar" label on the next locale pass and undo this update.
		this.title.setAttribute('data-i18n-ignore', '');
		this.title.textContent = `${titleText} ${t('settings.title')}`;
		this.historyContent.style.display = 'none';
		this.aiContent.style.display = 'none';
		this.groupSettingsContent.style.display = 'block';
		this.sidebar.style.display = 'flex';

		this.ribbonMirror?.destroy?.();
		this.groupSettingsContainer.innerHTML = '';
		this._palettePanelRefresh = null;
		if (this._palettePickerEl) {
			this.palette?.unmountGrid?.(this._palettePickerEl);
			this._palettePickerEl = null;
		}
		this.ribbonMirrorTitle = titleText;
		// Descriptor-driven option mirror mounts above the legacy visibility
		// rows; actions click the ribbon control so the two never diverge.
		const descriptorEntry = MIRROR_DESCRIPTORS[mirrorKey];
		const mirrorDescriptor = (typeof descriptorEntry === 'function'
			? descriptorEntry({
				openHistoryView: (view, options) => this.openHistoryView(view, options),
				openHistoryPreferences: (trigger) => this.openHistoryPreferences(trigger),
				brushState: this.brushState,
				getPrimaryColor: () => this.palette?.primary,
				setPrimaryColor: (color) => this.palette?.setPrimary(color),
				getPalette: () => this.palette?.getPalette?.() || [],
			})
			: descriptorEntry)
			|| { key: mirrorKey, layout: 'sections', sections: [], visibility: false };
		this.ribbonMirror = createRibbonMirror({ descriptor: mirrorDescriptor });
		this.groupSettingsContainer.appendChild(this.ribbonMirror.element);

		// Everything that controls the header ribbon lives in one disclosure so
		// the narrow sidebar stays scannable: "Toolbar view" everywhere, except
		// the Tools group which reads "Tools Header". The visibility rows come
		// first; the custom palette follows because its swatches are what the
		// ribbon grid renders.
		const visibilityDetails = applySectionState(document.createElement('details'), 'toolbar-view');
		visibilityDetails.className = 'disclosure-section';
		visibilityDetails.dataset.tag = 'sidebar-toolbar-view';
		const visibilitySummary = document.createElement('summary');
		visibilitySummary.className = 'disclosure-title';
		const visibilityChevron = document.createElement('span');
		visibilityChevron.className = 'menu-arrow';
		visibilityChevron.setAttribute('aria-hidden', 'true');
		visibilityChevron.textContent = '▾';
		const visibilityTitle = document.createElement('span');
		const visibilityTitleKey = groupSection.classList.contains('ribbon-group-tools')
			? 'ui.toolsHeader'
			: 'ui.toolbarView';
		visibilityTitle.textContent = t(visibilityTitleKey);
		visibilityTitle.setAttribute('data-i18n-runtime', visibilityTitleKey);
		visibilitySummary.append(visibilityChevron, visibilityTitle);
		visibilityDetails.append(visibilitySummary);
		const hr = document.createElement('hr');
		this.groupSettingsContainer.append(hr, visibilityDetails);

		const toggleGroup = document.createElement('div');
		toggleGroup.className = 'checkbox-row';
		toggleGroup.dataset.tag = 'sidebar-group-visibility-row';
		const cbGroup = document.createElement('input');
		cbGroup.type = 'checkbox';
		cbGroup.id = 'sidebar-group-visibility';
		cbGroup.dataset.tag = 'sidebar-group-visibility';
		const groupLabel = document.createElement('label');
		groupLabel.htmlFor = cbGroup.id;
		groupLabel.dataset.tag = 'sidebar-group-visibility-label';
		groupLabel.textContent = t('ui.showEntireGroup');
		const isExtras = groupSection.classList.contains('ribbon-group-extras');
		if (isExtras) cbGroup.disabled = true;
		cbGroup.checked = [...groupSection.children]
			.filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input')
			.some((child) => !child.hidden && child.style.display !== 'none');
		toggleGroup.appendChild(cbGroup);
		toggleGroup.append(cbGroup, groupLabel);
		cbGroup.addEventListener('change', (e) => {
			if (isExtras) return;
			const groupContent = [...groupSection.children]
				.filter((child) => !child.classList.contains('ribbon-group-title') && child.id !== 'file-input');
			groupContent.forEach((child) => {
				child.hidden = !e.target.checked;
				child.style.display = e.target.checked ? '' : 'none';
			});
			groupSection.hidden = !e.target.checked;
			const nextSibling = groupSection.nextElementSibling;
			if (nextSibling && nextSibling.classList.contains('separator')) {
				nextSibling.style.display = e.target.checked ? 'block' : 'none';
			}
			this._saveRibbonButtonState();
			window.dispatchEvent(new CustomEvent('paint:ribbon-change'));
		});
		visibilityDetails.appendChild(toggleGroup);

		if (groupSection.classList.contains('ribbon-group-tools')) {
			const currentToolToggle = document.createElement('div');
			currentToolToggle.className = 'checkbox-row';
			currentToolToggle.dataset.tag = 'sidebar-current-tool-row';
			const currentToolCheckbox = document.createElement('input');
			currentToolCheckbox.type = 'checkbox';
			currentToolCheckbox.id = 'show-current-tool-toggle';
			currentToolCheckbox.dataset.tag = 'show-current-tool-toggle';
			try { currentToolCheckbox.checked = localStorage.getItem('paint:show-current-tool') !== 'false'; } catch { currentToolCheckbox.checked = true; }
			currentToolCheckbox.addEventListener('change', (event) => {
				window.dispatchEvent(new CustomEvent('paint:show-current-tool-change', { detail: event.target.checked }));
				this._saveRibbonButtonState();
			});
			const currentToolLabel = document.createElement('label');
			currentToolLabel.htmlFor = currentToolCheckbox.id;
			currentToolLabel.dataset.tag = 'show-current-tool-label';
			currentToolLabel.textContent = t('ui.showCurrentTool');
			currentToolToggle.append(currentToolCheckbox, currentToolLabel);
			visibilityDetails.appendChild(currentToolToggle);
		}

		// Keep the original menu-action filter contract visible for compatibility:
		// .filter((btn) => btn.id !== 'btn-remove-bg' && !btn.closest('.action-menu-items'))
		const buttons = [...groupSection.querySelectorAll('.rbtn')]
			.filter((btn) => btn.id !== 'btn-remove-bg' && btn.id !== 'btn-settings' && btn.id !== 'tool-status' && !btn.closest('.action-menu-items'));
		buttons.forEach((btn) => {
			let btnLabel = btn.title || btn.dataset.tool || btn.dataset.shape || btn.textContent.trim();
			const visibilityKey = btn.id || btn.dataset.tag || btn.dataset.tool || btn.dataset.shape;
			if (!visibilityKey) return;
			const toggleBtn = document.createElement('div');
			toggleBtn.className = 'checkbox-row';
			toggleBtn.dataset.tag = `sidebar-button-visibility-row-${visibilityKey}`;
			const cbBtn = document.createElement('input');
			cbBtn.type = 'checkbox';
			cbBtn.id = `sidebar-button-visibility-${visibilityKey}`;
			cbBtn.dataset.tag = cbBtn.id;
			cbBtn.checked = !btn.hidden && btn.style.display !== 'none';
			const buttonLabel = document.createElement('label');
			buttonLabel.htmlFor = cbBtn.id;
			buttonLabel.dataset.tag = `${cbBtn.id}-label`;
			buttonLabel.textContent = t('ui.showLabel', { label: btnLabel });
			toggleBtn.append(cbBtn, buttonLabel);
			cbBtn.addEventListener('change', (e) => {
				btn.hidden = !e.target.checked;
				btn.style.display = e.target.checked ? '' : 'none';
				if (btn.id === 'btn-ai-chat') {
					window.dispatchEvent(new CustomEvent('paint:ai-chat-visibility-change', {
						detail: e.target.checked,
					}));
				}
				this._saveRibbonButtonState();
				window.dispatchEvent(new CustomEvent('paint:ribbon-change'));
			});
			visibilityDetails.appendChild(toggleBtn);
		});
		// The colours group appends its palette picker + custom palette last so
		// the two visibility checkboxes always read first inside the disclosure.
		if (groupSection.classList.contains('ribbon-group-colors') && this.palette) {
			this._appendPaletteSettings(visibilityDetails);
		}
		// Restoring a remembered panel must not rewrite the state we just read.
		if (remember) this._saveSidebarState();
	}

	// Keep mounted mirror controls truthful: disabled ribbon state (undo/redo,
	// crop) and shared settings (alpha) re-read through the descriptor getters.
	syncRibbonMirror() {
		try { this.ribbonMirror?.sync(); } catch { /* mirror is optional */ }
	}

	// Phase 2 step-04: the History tab's own undo/redo buttons follow the same
	// state event the ribbon uses (no polling).
	syncHistoryControls(canUndo, canRedo) {
		if (this.historyUndoBtn) this.historyUndoBtn.disabled = !canUndo;
		if (this.historyRedoBtn) this.historyRedoBtn.disabled = !canRedo;
	}

	// Phase 2 step-04: main.js owns the Settings dialog, so the Extras deep
	// link for Preferences is injected instead of duplicated here.
	setHistoryDeepLinks({ openPreferences = null } = {}) {
		this._openHistoryPreferences = openPreferences;
	}

	// Deep link used by the Extras mirror entries: open the History panel on the
	// requested view and move focus into it.
	openHistoryView(view, { trigger = null } = {}) {
		this._returnFocusTo = trigger || document.activeElement;
		this.showHistory();
		this.historyPanel?.setView?.(view);
		// Focus lands on the next frame: the panel renders asynchronously after
		// the sidebar becomes visible, and an early focus() would be dropped.
		const focusPanel = () => this.historyPanel?.focusActiveView?.();
		if (typeof globalThis.requestAnimationFrame === 'function') globalThis.requestAnimationFrame(focusPanel);
		else focusPanel();
	}

	openHistoryPreferences(trigger = null) {
		if (trigger) this._returnFocusTo = trigger;
		this._openHistoryPreferences?.();
	}

	_appendPaletteSettings(parent) {
		const section = document.createElement('section');
		section.className = 'palette-settings-editor';
		section.dataset.tag = 'sidebar-palette-settings';

		// Extended copy of the ribbon's palette grid: the sidebar has room for
		// bigger swatches and lists every built-in palette at once (p1 + p2 plus
		// the 56 extra swatches from p3/p4). A click writes the foreground colour
		// through the same ColorPalette source of truth (never a second palette).
		const picker = document.createElement('div');
		picker.className = 'palette-grid palette-grid-extended';
		picker.dataset.tag = 'sidebar-palette-picker';
		picker.setAttribute('role', 'group');
		picker.setAttribute('aria-label', t('ui.palettePicker'));
		section.appendChild(picker);
		this.palette.mountGrid?.(picker, { mode: 'extended' });
		this._palettePickerEl = picker;

		// Custom palette collapses like every other disclosure section, because
		// its swatches shape the header ribbon and rarely need editing.
		const custom = applySectionState(document.createElement('details'), 'custom-palette');
		custom.className = 'disclosure-section';
		custom.dataset.tag = 'sidebar-custom-palette';
		const summary = document.createElement('summary');
		summary.className = 'disclosure-title';
		const chevron = document.createElement('span');
		chevron.className = 'menu-arrow';
		chevron.setAttribute('aria-hidden', 'true');
		chevron.textContent = '▾';
		const heading = document.createElement('span');
		heading.textContent = t('ui.customPalette');
		heading.setAttribute('data-i18n-runtime', 'ui.customPalette');
		summary.append(chevron, heading);
		custom.appendChild(summary);

		const defaultRow = document.createElement('div');
		defaultRow.className = 'palette-default-row';
		const defaultInput = document.createElement('input');
		defaultInput.type = 'color';
		defaultInput.value = this.palette.defaultPrimary;
		const defaultLabel = document.createElement('span');
		defaultLabel.textContent = t('ui.defaultSelectedColor');
		defaultLabel.setAttribute('data-i18n-runtime', 'ui.defaultSelectedColor');
		const useCurrent = document.createElement('button');
		useCurrent.type = 'button';
		useCurrent.textContent = t('ui.useCurrent');
		useCurrent.setAttribute('data-i18n-runtime', 'ui.useCurrent');
		useCurrent.addEventListener('click', () => {
			this.palette.setDefaultPrimary(this.palette.primary);
			defaultInput.value = this.palette.defaultPrimary;
		});
		defaultInput.addEventListener('input', () => this.palette.setDefaultPrimary(defaultInput.value));
		defaultRow.append(defaultLabel, defaultInput, useCurrent);
		custom.appendChild(defaultRow);

		// Switch between COLOR_PALETTE_1 (default), COLOR_PALETTE_2 (classic),
		// the saved snapshot, or snapshot whatever palette is currently shown.
		const presetRow = document.createElement('div');
		presetRow.className = 'palette-preset-row';
		const presetButtons = [
			['p1', 'ui.palettePreset1', 'palette-preset-1'],
			['p2', 'ui.palettePreset2', 'palette-preset-2'],
			['custom', 'ui.paletteCustom', 'palette-preset-custom'],
			['save', 'ui.paletteSaveCurrent', 'palette-preset-save'],
		].map(([preset, key, tag]) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'palette-preset';
			button.dataset.tag = tag;
			button.dataset.palettePreset = preset;
			button.textContent = t(key);
			button.setAttribute('data-i18n-runtime', key);
			presetRow.appendChild(button);
			return { button, preset };
		});
		custom.appendChild(presetRow);

		const grid = document.createElement('div');
		grid.className = 'palette-settings-grid';
		grid.dataset.tag = 'sidebar-palette-settings-grid';
		grid.addEventListener('input', (event) => {
			const input = event.target.closest?.('input[data-palette-index]');
			if (!input || !grid.contains(input)) return;
			const index = Number(input.dataset.paletteIndex);
			const next = this.palette.getPalette();
			if (!Number.isInteger(index) || index < 0 || index >= next.length) return;
			next[index] = input.value;
			this.palette.setPalette(next);
		});
		const renderSettingsGrid = () => {
			const colors = this.palette.getPalette();
			const existing = [...grid.querySelectorAll('input[type="color"]')];
			if (existing.length === colors.length) {
				// Update in place so dragging one colour input is never
				// interrupted by a rebuild from its own write.
				existing.forEach((input, index) => {
					if (input.value !== colors[index]) input.value = colors[index];
				});
				return;
			}
			grid.replaceChildren();
			colors.forEach((color, index) => {
				const input = document.createElement('input');
				input.type = 'color';
				input.value = color;
				input.dataset.paletteIndex = String(index);
				input.title = `Palette color ${index + 1}`;
				grid.appendChild(input);
			});
		};
		custom.appendChild(grid);

		const syncPresetButtons = () => {
			const colors = this.palette.getPalette();
			const saved = this.palette.savedPalette;
			const sameAs = (other) => Array.isArray(other)
				&& other.length === colors.length
				&& other.every((hex, index) => hex === colors[index]);
			const presetId = colorPalettePreset(colors);
			presetButtons.forEach(({ button, preset }) => {
				if (preset === 'save') return;
				const active = preset === 'custom' ? sameAs(saved) : presetId === preset;
				button.classList.toggle('active', active);
				button.setAttribute('aria-pressed', String(active));
				if (preset === 'custom') button.disabled = !saved;
			});
		};
		presetRow.addEventListener('click', (event) => {
			const button = event.target.closest?.('button[data-palette-preset]');
			if (!button || !presetRow.contains(button)) return;
			const preset = button.dataset.palettePreset;
			if (preset === 'save') {
				this.palette.savePaletteSnapshot?.();
				syncPresetButtons();
				return;
			}
			if (preset === 'custom') {
				if (this.palette.savedPalette) this.palette.applySavedPalette?.();
				return;
			}
			// Preset writes dispatch `paint:palette-change`, which re-runs this
			// panel's refresh closure so grids and buttons stay in step.
			this.palette.applyPalette?.(preset);
		});

		const refresh = () => {
			renderSettingsGrid();
			syncPresetButtons();
			this._syncPalettePicker();
		};
		this._palettePanelRefresh = refresh;
		refresh();

		section.appendChild(custom);
		parent.appendChild(section);
	}

	// Selected-state outline for the extended picker: one click already writes
	// the primary, this just keeps the "chosen" swatch visible.
	_syncPalettePicker() {
		const picker = this._palettePickerEl;
		if (!picker) return;
		const primary = this.palette?.primary;
		picker.querySelectorAll('button[data-color]').forEach((button) => {
			const active = button.dataset.color === primary;
			button.classList.toggle('active', active);
			button.setAttribute('aria-pressed', String(active));
		});
	}

	hide() {
		this.sidebar.style.display = 'none';
		this._saveSidebarState();
		// Phase 2 step-04: a deep link (Extras -> History) returns focus to the
		// entry that opened it. When that entry lives inside this sidebar it is
		// hidden now too, so focus falls back to the ribbon History button.
		const trigger = this._returnFocusTo;
		this._returnFocusTo = null;
		const target = trigger?.isConnected && trigger.offsetParent !== null
			? trigger
			: document.getElementById('btn-history-panel');
		target?.focus?.();
	}

	_bindResizer() {
		const resizer = document.getElementById('sidebar-resizer');
		if (!resizer) return;

		let isResizing = false;
		let startX = 0;
		let startWidth = 0;
		let pointerId = null;

		const stop = () => {
			if (!isResizing) return;
			isResizing = false;
			pointerId = null;
			document.body.style.cursor = '';
			this._saveSidebarWidth();
		};
		resizer.addEventListener('pointerdown', (e) => {
			if (e.button != null && e.button !== 0) return;
			isResizing = true;
			pointerId = e.pointerId;
			startX = e.clientX;
			startWidth = parseInt(document.defaultView.getComputedStyle(this.sidebar).width, 10) || 250;
			resizer.setPointerCapture?.(pointerId);
			document.body.style.cursor = 'ew-resize';
			e.preventDefault();
		});
		resizer.addEventListener('pointermove', (e) => {
			if (!isResizing || e.pointerId !== pointerId) return;
			const dx = document.documentElement?.dir === 'rtl'
				? e.clientX - startX
				: startX - e.clientX;
			const newWidth = Math.max(220, Math.min(startWidth + dx, window.innerWidth * 0.8));
			this.sidebar.style.width = `${newWidth}px`;
		});
		resizer.addEventListener('pointerup', stop);
		resizer.addEventListener('pointercancel', stop);
	}

	_saveSidebarState() {
		const state = {
			isOpen: this.sidebar.style.display !== 'none',
			activeTab: this.activeTab
		};
		try {
			localStorage.setItem('paint:sidebar-state', JSON.stringify(state));
		} catch (err) {
			console.warn('Unable to save sidebar state:', err);
		}
	}

	_saveSidebarWidth() {
		try { localStorage.setItem('paint:sidebar-width', this.sidebar.style.width || '250px'); } catch { }
	}

	_restoreSidebarWidth() {
		try {
			const width = parseInt(localStorage.getItem('paint:sidebar-width'), 10);
			if (Number.isFinite(width)) this.sidebar.style.width = `${Math.max(220, Math.min(width, window.innerWidth * 0.8))}px`;
		} catch { }
	}

	_restoreSidebarState() {
		try {
			const stored = localStorage.getItem('paint:sidebar-state');
			if (!stored) return;
			const state = JSON.parse(stored);
			if (!state.isOpen) return;
			this._pendingSidebarRestore = state.activeTab || null;
			this._restoreSidebarPanel(state.activeTab);
		} catch (err) {
			console.warn('Unable to restore sidebar state:', err);
		}
	}

	/**
	 * Reopen the panel the user last had open. Every panel type is supported:
	 * history, AI chat and the ribbon-group mirrors. Group mirrors resolve from
	 * their stable ribbon key, because the group sections may not exist yet at
	 * construction time — the retry runs once the ribbon is wired.
	 */
	_restoreSidebarPanel(activeTab) {
		if (!activeTab) return false;
		if (activeTab === HISTORY_VIEWS.history) {
			// Just set the active tab, don't refresh yet - wait for finishInit()
			this.activeTab = HISTORY_VIEWS.history;
			this.title.textContent = 'History';
			this.historyContent.style.display = 'block';
			this.aiContent.style.display = 'none';
			if (this.groupSettingsContent) this.groupSettingsContent.style.display = 'none';
			this.sidebar.style.display = 'flex';
			return true;
		}
		if (activeTab === 'ai') {
			this.showAi();
			return true;
		}
		if (activeTab.startsWith('group:')) {
			const key = activeTab.slice('group:'.length);
			const section = document.querySelector(`[data-ribbon-key="${key}"]`)
				|| document.querySelector(`.ribbon-group-${key}`);
			if (!section) return false;
			this.openGroupSettings(section, { remember: false });
			return true;
		}
		return false;
	}

	/** Called once the ribbon groups exist, so a remembered group panel can open. */
	restorePendingPanel() {
		const activeTab = this._pendingSidebarRestore;
		if (!activeTab) return;
		if (this._restoreSidebarPanel(activeTab)) this._pendingSidebarRestore = null;
	}

	_saveRibbonButtonState() {
		try {
			const buttonState = {};
			const buttons = document.querySelectorAll('.rbtn');
			buttons.forEach((btn) => {
				if (btn.id) {
					buttonState[btn.id] = {
						hidden: btn.hidden,
						display: btn.style.display
					};
				}
			});
			localStorage.setItem('paint:ribbon-button-state', JSON.stringify(buttonState));
		} catch (err) {
			console.warn('Unable to save ribbon button state:', err);
		}
	}

	_restoreRibbonButtonState() {
		try {
			const stored = localStorage.getItem('paint:ribbon-button-state');
			if (!stored) return;
			const buttonState = JSON.parse(stored);

			Object.keys(buttonState).forEach((btnId) => {
				const btn = document.getElementById(btnId);
				if (btn) {
					btn.hidden = buttonState[btnId].hidden;
					btn.style.display = buttonState[btnId].display;
				}
			});
		} catch (err) {
			console.warn('Unable to restore ribbon button state:', err);
		}
	}

	async refreshHistory() {
		const generation = (this._historyRefreshGeneration || 0) + 1;
		this._historyRefreshGeneration = generation;
		const scrollTop = this.historyGrid.scrollTop;
		this.historyGrid.innerHTML = '';
		this._historyItemsByKey.clear();
		if (this.historyView === HISTORY_VIEWS.session) {
			const count = await this._renderSessionView();
			if (generation === this._historyRefreshGeneration) this.historyGrid.scrollTop = scrollTop;
			return count;
		}
		const sessions = await this.globalHistory.getSessions();
		if (generation !== this._historyRefreshGeneration) return 0;
		if (sessions.length === 0) {
			const message = this.globalHistory.historyEnabled ? 'No history found' : 'History saving is off';
			this.historyGrid.innerHTML = `<div class="history-empty">${message}</div>`;
			this.historyGrid.scrollTop = scrollTop;
			return 0;
		}

		sessions.forEach((session, index) => {
			const item = document.createElement('div');
			item.className = 'history-item';
			const historyKey = `global:${session.id}`;
			item.dataset.historyKey = historyKey;
			this._historyItemsByKey.set(historyKey, { type: 'global', entry: session, index });

			const img = document.createElement('img');
			img.loading = 'lazy';
			img.src = getHistoryPreviewUrl(session);
			img.alt = `Import history image ${index + 1} of ${sessions.length}`;
			img.title = 'Click to import this image';
			img.dataset.historyAction = 'restore';
			item.appendChild(img);

			const info = document.createElement('div');
			info.className = 'history-info';
			const d = new Date(session.timestamp);
			info.textContent = `${index + 1}/${sessions.length} · ${formatUnambiguousDate(d)}, ${formatUnambiguousTime(d)} · ${session.width}x${session.height}`;
			item.appendChild(info);

			const deleteButton = document.createElement('button');
			deleteButton.type = 'button';
			deleteButton.className = 'history-delete';
			deleteButton.innerHTML = '<span style="position: relative; inset-inline-end: 2px;" aria-hidden="true">🗑</span>';
			deleteButton.setAttribute('aria-label', `Delete history image ${index + 1} of ${sessions.length}`);
			deleteButton.title = 'Delete this saved image';
			deleteButton.dataset.historyAction = 'delete';
			item.appendChild(deleteButton);

			const saveButton = document.createElement('button');
			saveButton.type = 'button';
			saveButton.className = 'history-save';
			saveButton.innerHTML = '<span aria-hidden="true">⬇</span>';
			saveButton.setAttribute('aria-label', `Save history image ${index + 1} of ${sessions.length} to computer`);
			saveButton.title = 'Save this image to your computer';
			saveButton.dataset.historyAction = 'save';
			item.append(saveButton);

			this.historyGrid.appendChild(item);
		});
		this.historyGrid.scrollTop = scrollTop;
		return sessions.length;
	}

	// Session view: undo snapshots + current canvas, so the user can jump back
	// to an exact moment without pressing Undo N times. Backed by
	// sessionStorage thumbnails: survives refresh, dies with the browser tab.
	async _renderSessionView() {
		const entries = this.historyManager?.getSessionEntries?.() || [];
		if (entries.length === 0) {
			this.historyGrid.innerHTML = '<div class="history-empty">No session steps yet - draw something first</div>';
			return 0;
		}
		entries.forEach((entry, index) => {
			const item = document.createElement('div');
			item.className = 'history-item';
			const historyKey = `session:${entry.id}`;
			item.dataset.historyKey = historyKey;
			this._historyItemsByKey.set(historyKey, { type: 'session', entry, index });
			const img = document.createElement('img');
			img.loading = 'lazy';
			const previewSrc = getHistoryPreviewUrl(entry);
			if (previewSrc) img.src = previewSrc;
			else if (entry.pending && entry.ready) {
				void entry.ready.then(() => {
					const readyPreviewSrc = getHistoryPreviewUrl(entry);
					if (readyPreviewSrc && img.isConnected) img.src = readyPreviewSrc;
				});
			}
			img.alt = `Session step ${index + 1} of ${entries.length}`;
			img.title = 'Click to restore this session step';
			img.dataset.historyAction = 'restore';
			item.appendChild(img);
			const info = document.createElement('div');
			info.className = 'history-info';
			info.textContent = `${entry.label || `Step ${index + 1}`} · ${entry.width}x${entry.height}`;
			item.appendChild(info);
			const deleteButton = document.createElement('button');
			deleteButton.type = 'button';
			deleteButton.className = 'history-delete';
			deleteButton.innerHTML = '<span style="position: relative; inset-inline-end: 2px;" aria-hidden="true">🗑</span>';
			deleteButton.setAttribute('aria-label', entry.kind === 'current'
				? 'Hide current session image'
				: `Delete session step ${index + 1} of ${entries.length}`);
			deleteButton.title = entry.kind === 'current' ? 'Hide current session card' : 'Delete this session step';
			deleteButton.dataset.historyAction = 'delete';
			item.appendChild(deleteButton);
			const saveButton = document.createElement('button');
			saveButton.type = 'button';
			saveButton.className = 'history-save';
			saveButton.innerHTML = '<span aria-hidden="true">⬇</span>';
			saveButton.setAttribute('aria-label', `Save session step ${index + 1} of ${entries.length} to computer`);
			saveButton.title = 'Save this step to your computer';
			saveButton.dataset.historyAction = 'save';
			item.append(saveButton);
			this.historyGrid.appendChild(item);
		});
		return entries.length;
	}

	async _handleHistoryItemClick(event) {
		const actionElement = event.target?.closest?.('[data-history-action]');
		if (!actionElement || !this.historyGrid.contains(actionElement)) return;
		const item = actionElement.closest('.history-item');
		const record = item && this._historyItemsByKey.get(item.dataset.historyKey);
		if (!record) return;

		const { type, entry, index } = record;
		if (actionElement.dataset.historyAction === 'restore') {
			if (type === 'session' && entry.pending) await entry.ready;
			const confirmed = await this.dialogService.confirm(getRestoreConfirmOptions({
				src: getHistoryPreviewSource(entry),
				alt: type === 'global'
					? `Preview of saved image ${index + 1}`
					: `Preview of ${entry.label || `session step ${index + 1}`}`,
			}));
			if (!confirmed) return;
			if (type === 'global') {
				await this.canvasManager.loadImageDataUrl(entry.dataUrl, entry.width, entry.height);
				this.statusBar.flash('Loaded from history');
			} else {
				await this.historyManager.restore(entry);
				this.statusBar.flash('Restored session step');
				void this.refreshHistory();
			}
			return;
		}

		event.stopPropagation();
		if (actionElement.dataset.historyAction === 'delete') {
			if (type === 'global') {
				await this.globalHistory.deleteSession(entry.id);
				await this.refreshHistory();
				this.statusBar.flash('History item deleted');
			} else if (this.historyManager.removeSessionEntry(entry.id)) {
				void this.refreshHistory();
				this.statusBar?.flash?.(entry.kind === 'current' ? 'Current session card hidden' : 'Session step deleted');
			}
			return;
		}
		if (actionElement.dataset.historyAction === 'save') {
			window.dispatchEvent(new CustomEvent('paint:history-export-item', {
				detail: { session: entry, index },
			}));
		}
	}

	async handleAiSubmit(commandInput = null) {
		const text = String(commandInput ?? this.aiInput.value).trim();
		if (!text) return;
		this.aiInput.value = '';

		// Append user message
		const uMsg = document.createElement('div');
		uMsg.className = 'ai-msg user';
		uMsg.textContent = text;
		this.aiMessages.appendChild(uMsg);

		const result = this.aiCommandService
			? await this.aiCommandService.execute(text)
			: { reply: 'Deterministic actions are not ready yet.' };
		const bMsg = document.createElement('div');
		bMsg.className = `ai-msg bot${result.matched ? ' ai-msg-applied' : ''}`;
		bMsg.textContent = result.reply;
		this.aiMessages.appendChild(bMsg);

		this.aiMessages.scrollTop = this.aiMessages.scrollHeight;
	}
}
