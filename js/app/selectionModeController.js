import { SELECTION_MODES } from '../core/constants.js';

export const createSelectionModeController = ({
	selectTool,
	toolManager,
	rectangleButton,
	lassoButton,
	selectionButtons = [],
} = {}) => {
	if (!selectTool || !toolManager) throw new Error('Selection mode controller requires the Select tool and ToolManager');
	const buttons = new Map([
		[SELECTION_MODES.rectangle, rectangleButton],
		[SELECTION_MODES.lasso, lassoButton],
	]);

	const syncMode = (mode) => {
		for (const [buttonMode, button] of buttons) {
			if (!button) continue;
			const active = buttonMode === mode;
			button.classList.toggle('active', active);
			button.setAttribute('aria-checked', String(active));
		}
		const iconSource = buttons.get(mode)?.querySelector('svg');
		if (!iconSource) return;
		for (const button of selectionButtons) {
			const icon = button?.querySelector('svg');
			if (icon) icon.innerHTML = iconSource.innerHTML;
		}
	};
	const setMode = (mode) => {
		selectTool.setMode(mode);
		syncMode(mode);
		toolManager.setActive('select');
	};

	const bindings = [...buttons].flatMap(([mode, button]) => {
		if (!button) return [];
		const onClick = () => setMode(mode);
		button.addEventListener('click', onClick);
		return [[button, onClick]];
	});
	syncMode(selectTool.getMode());

	return Object.freeze({
		setMode,
		destroy: () => bindings.forEach(([button, listener]) => button.removeEventListener('click', listener)),
	});
};
