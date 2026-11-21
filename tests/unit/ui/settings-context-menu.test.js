import assert from 'node:assert/strict';
import test from 'node:test';
import { createSettingsContextMenu } from '../../../js/ui/SettingsContextMenu.js';

const makeNode = (rect) => {
	const listeners = new Map();
	const node = {
		dataset: {},
		classList: { contains: () => false },
		focused: 0,
		addEventListener(type, listener) {
			const handlers = listeners.get(type) || new Set();
			handlers.add(listener);
			listeners.set(type, handlers);
		},
		removeEventListener(type, listener) {
			listeners.get(type)?.delete(listener);
		},
		dispatch(type, event = {}) {
			event.target ||= node;
			event.currentTarget = node;
			event.preventDefault ||= () => { event.defaultPrevented = true; };
			event.stopPropagation ||= () => { event.propagationStopped = true; };
			[...(listeners.get(type) || [])].forEach((listener) => listener(event));
			return event;
		},
		focus() { node.focused += 1; },
		closest(selector) {
			return selector === '[data-settings-context-action]' && node.dataset.settingsContextAction
				? node
				: null;
		},
		getBoundingClientRect: () => rect,
		contains(target) { return target === node || target === node.menuItem; },
		querySelector(selector) {
			return selector.includes('[role="menuitem"]') ? node.menuItem : null;
		},
	};
	return node;
};

const createNode = ({ rect = { left: 10, right: 50, top: 20, bottom: 40 } } = {}) => {
	const node = makeNode(rect);
	node.menuItem = makeNode(rect);
	return { node, menuItem: node.menuItem };
};

const createDocument = () => {
	const listeners = new Map();
	return {
		activeElement: null,
		addEventListener(type, listener) {
			const handlers = listeners.get(type) || new Set();
			handlers.add(listener);
			listeners.set(type, handlers);
		},
		removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
		dispatch(type, event) {
			[...(listeners.get(type) || [])].forEach((listener) => listener(event));
		},
	};
};

test('right-click opens the shared menu and choosing Settings preserves its trigger', () => {
	const { node: target } = createNode();
	const { node: menu, menuItem } = createNode();
	menuItem.dataset.settingsContextAction = 'settings';
	const documentRef = createDocument();
	const opened = [];
	const selected = [];
	const controller = createSettingsContextMenu({
		bindings: [{ target, menu }],
		openMenuAt: (...args) => opened.push(args),
		onSelect: (selection) => selected.push(selection),
		documentRef,
	});
	const event = target.dispatch('contextmenu', { clientX: 120, clientY: 80 });

	assert.equal(event.defaultPrevented, true);
	assert.deepEqual(opened, [[menu, { x: 120, y: 80 }]]);
	assert.equal(menuItem.focused, 1);
	menu.dispatch('click', { target: menuItem });
	assert.deepEqual(selected, [{ action: 'settings', trigger: target }]);

	controller.destroy();
	target.dispatch('contextmenu', { clientX: 1, clientY: 1 });
	assert.equal(opened.length, 1);
});

test('Shift+F10 opens the menu at the focused trigger and Escape restores focus', () => {
	const { node: target } = createNode();
	const { node: menu, menuItem } = createNode();
	const documentRef = createDocument();
	const opened = [];
	let closed = 0;
	const controller = createSettingsContextMenu({
		bindings: [{ target, menu }],
		openMenuAt: (...args) => {
			opened.push(args);
			menu.classList.contains = () => true;
		},
		closeMenus: () => { closed += 1; menu.classList.contains = () => false; },
		documentRef,
	});
	target.dispatch('keydown', { key: 'F10', shiftKey: true });
	menu.dispatch('keydown', { key: 'Escape' });

	assert.deepEqual(opened, [[menu, { x: 10, y: 40 }]]);
	assert.equal(closed, 1);
	assert.equal(target.focused, 1);
	controller.destroy();
});
