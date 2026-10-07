import assert from 'node:assert/strict';
import test from 'node:test';
import { createCommandRegistry } from '../js/app/CommandRegistry.js';
import { createGlobalShortcutController } from '../js/app/GlobalShortcutController.js';
import { SHORTCUT_ACTIONS } from '../js/core/constants.js';
import { createShortcutManager } from '../js/settings/ShortcutManager.js';

const createEventTarget = () => {
	const listeners = new Map();
	return {
		addEventListener(type, listener, capture) {
			listeners.set(`${type}:${capture}`, listener);
		},
		removeEventListener(type, listener, capture) {
			if (listeners.get(`${type}:${capture}`) === listener) listeners.delete(`${type}:${capture}`);
		},
		dispatch(type, event, capture = true) {
			listeners.get(`${type}:${capture}`)?.(event);
		},
		listenerCount: () => listeners.size,
	};
};

const createKeyEvent = ({ code, key, ctrlKey = false, metaKey = false } = {}) => ({
	code,
	key,
	ctrlKey,
	metaKey,
	altKey: false,
	shiftKey: false,
	defaultPrevented: false,
	preventCount: 0,
	stopCount: 0,
	preventDefault() {
		this.preventCount += 1;
		this.defaultPrevented = true;
	},
	stopPropagation() { this.stopCount += 1; },
});

test('global shortcuts dispatch the shared commands from physical key codes on Ctrl and Cmd', () => {
	const calls = [];
	const eventTarget = createEventTarget();
	const commandRegistry = createCommandRegistry({
		commands: {
			[SHORTCUT_ACTIONS.undo]: () => calls.push('undo'),
			[SHORTCUT_ACTIONS.selectAll]: () => calls.push('selectAll'),
		},
	});
	const controller = createGlobalShortcutController({
		commandRegistry,
		shortcutManager: createShortcutManager(),
		eventTarget,
		documentRef: { activeElement: { tagName: 'BODY' } },
	});
	controller.bind();

	const undo = createKeyEvent({ code: 'KeyZ', key: 'x', ctrlKey: true });
	const selectAll = createKeyEvent({ code: 'KeyA', key: 'ש', metaKey: true });
	eventTarget.dispatch('keydown', undo);
	eventTarget.dispatch('keydown', selectAll);

	assert.deepEqual(calls, ['undo', 'selectAll']);
	assert.equal(undo.preventCount, 1);
	assert.equal(undo.stopCount, 1);
	assert.equal(selectAll.preventCount, 1);
	assert.equal(selectAll.stopCount, 1);
	assert.equal(eventTarget.listenerCount(), 1);
	controller.destroy();
	assert.equal(eventTarget.listenerCount(), 0);
});

test('global shortcuts leave editable fields to their native editing commands', () => {
	const calls = [];
	const eventTarget = createEventTarget();
	const controller = createGlobalShortcutController({
		commandRegistry: createCommandRegistry({
			commands: { [SHORTCUT_ACTIONS.selectAll]: () => calls.push('selectAll') },
		}),
		shortcutManager: createShortcutManager(),
		eventTarget,
		documentRef: { activeElement: { tagName: 'TEXTAREA' } },
	});
	controller.bind();

	const event = createKeyEvent({ code: 'KeyA', key: 'a', ctrlKey: true });
	eventTarget.dispatch('keydown', event);

	assert.deepEqual(calls, []);
	assert.equal(event.preventCount, 0);
	assert.equal(event.stopCount, 0);
});

test('global arrow shortcuts defer to focused controls but still nudge from the page', () => {
	const calls = [];
	const eventTarget = createEventTarget();
	const button = {
		tagName: 'BUTTON',
		closest(selector) {
			return selector.includes('button') ? this : null;
		},
	};
	const body = { tagName: 'BODY', closest: () => null };
	const documentRef = { activeElement: button };
	const controller = createGlobalShortcutController({
		commandRegistry: createCommandRegistry({
			commands: { [SHORTCUT_ACTIONS.nudgeDown]: () => calls.push('nudgeDown') },
		}),
		shortcutManager: createShortcutManager(),
		eventTarget,
		documentRef,
	});
	controller.bind();

	const menuNavigation = createKeyEvent({ code: 'ArrowDown', key: 'ArrowDown' });
	eventTarget.dispatch('keydown', menuNavigation);
	assert.deepEqual(calls, []);
	assert.equal(menuNavigation.preventCount, 0);
	assert.equal(menuNavigation.stopCount, 0);

	documentRef.activeElement = body;
	const canvasNudge = createKeyEvent({ code: 'ArrowDown', key: 'ArrowDown' });
	eventTarget.dispatch('keydown', canvasNudge);
	assert.deepEqual(calls, ['nudgeDown']);
	assert.equal(canvasNudge.preventCount, 1);
	assert.equal(canvasNudge.stopCount, 1);
	controller.destroy();
});
