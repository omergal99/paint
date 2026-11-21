import { KEYBOARD_KEYS } from '../core/constants.js';

const isContextMenuKey = (event) => (
	event.key === KEYBOARD_KEYS.contextMenu
	|| (event.shiftKey && event.key === KEYBOARD_KEYS.f10)
);

export const createSettingsContextMenu = ({
	bindings = [],
	openMenuAt = () => {},
	closeMenus = () => {},
	onSelect = () => {},
	documentRef = globalThis.document,
} = {}) => {
	const returnTargets = new Map();
	const menuBindings = new Map();
	const cleanups = [];
	let destroyed = false;

	const focusTarget = (target) => target?.focus?.({ preventScroll: true });

	const open = (event, binding, keyboard = false) => {
		event.preventDefault();
		returnTargets.clear();
		const trigger = event.target?.closest?.('button')
			|| binding.focusTarget
			|| binding.target;
		returnTargets.set(binding.menu, trigger);
		const anchor = keyboard ? trigger : null;
		const rect = anchor?.getBoundingClientRect?.() || binding.target.getBoundingClientRect();
		openMenuAt(binding.menu, keyboard
			? { x: rect.left, y: rect.bottom }
			: { x: event.clientX, y: event.clientY });
		binding.menu.querySelector('.action-menu-items [role="menuitem"]:not([disabled])')?.focus();
	};

	const onDocumentClick = (event) => {
		for (const [menu, trigger] of returnTargets) {
			if (menu.contains(event.target)) continue;
			if (menu.contains(documentRef.activeElement)) focusTarget(trigger);
			returnTargets.delete(menu);
		}
	};

	bindings.forEach((binding) => {
		const onContextMenu = (event) => open(event, binding);
		const onKeyDown = (event) => {
			if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
			if (isContextMenuKey(event)) open(event, binding, true);
		};
		binding.target.addEventListener('contextmenu', onContextMenu);
		binding.target.addEventListener('keydown', onKeyDown);
		cleanups.push(() => {
			binding.target.removeEventListener('contextmenu', onContextMenu);
			binding.target.removeEventListener('keydown', onKeyDown);
		});
		if (!menuBindings.has(binding.menu)) menuBindings.set(binding.menu, binding);
	});

	menuBindings.forEach((binding, menu) => {
		const onMenuClick = (event) => {
			const item = event.target?.closest?.('[data-settings-context-action]');
			if (!item || !menu.contains(item)) return;
			const trigger = returnTargets.get(menu) || binding.focusTarget;
			returnTargets.delete(menu);
			onSelect({
				action: item.dataset.settingsContextAction,
				trigger,
			});
		};
		const onMenuKeyDown = (event) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			event.stopPropagation();
			const trigger = returnTargets.get(menu) || binding.focusTarget;
			returnTargets.delete(menu);
			closeMenus();
			focusTarget(trigger);
		};

		menu.addEventListener('click', onMenuClick);
		menu.addEventListener('keydown', onMenuKeyDown);
		cleanups.push(() => {
			menu.removeEventListener('click', onMenuClick);
			menu.removeEventListener('keydown', onMenuKeyDown);
		});
	});

	documentRef?.addEventListener('click', onDocumentClick);
	cleanups.push(() => documentRef?.removeEventListener('click', onDocumentClick));

	const destroy = () => {
		if (destroyed) return;
		destroyed = true;
		cleanups.forEach((cleanup) => cleanup());
		returnTargets.clear();
	};

	return Object.freeze({ destroy });
};
