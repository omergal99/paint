import { shortcutFromEvent } from '../settings/ShortcutManager.js';
import { KEYBOARD_KEYS, SHORTCUT_ACTIONS } from '../core/constants.js';

const isEditableTarget = (target) => {
	const tagName = target?.tagName;
	return ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName) || Boolean(target?.isContentEditable);
};

const isArrowNavigationTarget = (target) => Boolean(target?.closest?.(
	'button, a[href], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="tab"], [role="slider"], [role="separator"], [tabindex]:not([tabindex="-1"])',
));

export const createGlobalShortcutController = ({
	commandRegistry,
	shortcutManager,
	eventTarget = globalThis.window,
	documentRef = globalThis.document,
} = {}) => {
	const handleKeydown = (event) => {
		const activeElement = documentRef?.activeElement;
		if (event.defaultPrevented || event.isComposing || isEditableTarget(activeElement)) return;
		if (KEYBOARD_KEYS.arrows.includes(event.key) && isArrowNavigationTarget(activeElement)) return;

		const shortcut = shortcutFromEvent(event);
		const action = shortcutManager.resolve(shortcut);
		if (!action || !commandRegistry.has(action)) return;
		if (action === SHORTCUT_ACTIONS.paste && shortcutManager.isDefault(action, shortcut)) return;

		event.preventDefault();
		event.stopPropagation();
		commandRegistry.execute({ action, event, shortcut });
	};

	const bind = () => {
		eventTarget?.addEventListener?.('keydown', handleKeydown, true);
	};

	const destroy = () => {
		eventTarget?.removeEventListener?.('keydown', handleKeydown, true);
	};

	return Object.freeze({ bind, destroy });
};
