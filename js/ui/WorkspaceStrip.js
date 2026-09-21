// Small, DOM-light controller for the document strip. The strip is optional
// workspace chrome, so its visibility must not be coupled to canvas state.

import { STORAGE_KEYS } from '../core/constants.js';

export const WORKSPACE_STRIP_MODES = Object.freeze({ tabs: 'tabs', split: 'split' });

const normalizeMode = (mode) => Object.values(WORKSPACE_STRIP_MODES).includes(mode)
	? mode : WORKSPACE_STRIP_MODES.tabs;

export const createWorkspaceStripModel = ({ visible = false, mode = WORKSPACE_STRIP_MODES.tabs } = {}) => Object.freeze({
	visible: visible !== false,
	mode: normalizeMode(mode),
});

const readVisibility = (storage, key, fallback) => {
	try {
		const value = storage?.getItem?.(key);
		if (value === '1' || value === 'true') return true;
		if (value === '0' || value === 'false') return false;
	} catch {
		// Storage can be unavailable (private mode, blocked origin, quota policy).
	}
	return fallback;
};

const writeVisibility = (storage, key, visible) => {
	try { storage?.setItem?.(key, visible ? '1' : '0'); } catch { /* best effort */ }
};

const defaultStorage = () => {
	try { return globalThis.localStorage || null; } catch { return null; }
};

/**
 * Bind a visibility button to a workspace strip without owning its tabs or
 * panes. A manager button is optional and can open a future document manager.
 */
export const createWorkspaceStripController = ({ root = null, toggleButton = null, manageButton = null, labelElement = null, onManage, visibleLabel = 'Hide workspace strip', hiddenLabel = 'Show workspace strip', storage = defaultStorage(), storageKey = STORAGE_KEYS.workspaceStripVisible, defaultVisible = false, visible } = {}) => {
	let destroyed = false;
	const initialVisible = typeof visible === 'boolean' ? visible : readVisibility(storage, storageKey, defaultVisible);
	let state = createWorkspaceStripModel({ visible: initialVisible });
	const sync = () => {
		if (destroyed) return;
		if (root) {
			root.hidden = !state.visible;
			root.setAttribute('aria-hidden', String(!state.visible));
		}
		if (toggleButton) {
			toggleButton.dataset.tag ||= 'workspace-strip-toggle';
			toggleButton.setAttribute('aria-pressed', String(state.visible));
			toggleButton.setAttribute('aria-label', state.visible ? 'Hide open images' : 'Show open images');
			toggleButton.title = state.visible ? 'Hide open images' : 'Show open images';
		}
		if (labelElement) labelElement.textContent = state.visible ? visibleLabel : hiddenLabel;
	};
	const toggle = () => {
		if (destroyed) return state;
		state = createWorkspaceStripModel({ ...state, visible: !state.visible });
		writeVisibility(storage, storageKey, state.visible);
		sync();
		return state;
	};
	const onToggle = () => toggle();
	const onManageClick = () => { if (!destroyed) onManage?.(); };
	toggleButton?.addEventListener?.('click', onToggle);
	manageButton?.addEventListener?.('click', onManageClick);
	sync();
	return Object.freeze({
		getState: () => state,
		setVisible(visible) {
			if (destroyed) return state;
			state = createWorkspaceStripModel({ ...state, visible });
			writeVisibility(storage, storageKey, state.visible);
			sync();
			return state;
		},
		toggle,
		destroy() {
		if (destroyed) return;
			destroyed = true;
			toggleButton?.removeEventListener?.('click', onToggle);
			manageButton?.removeEventListener?.('click', onManageClick);
		},
	});
};
