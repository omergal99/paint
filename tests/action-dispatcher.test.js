import assert from 'node:assert/strict';
import test from 'node:test';
import { createActionDispatcher } from '../js/ui/ActionDispatcher.js';

const createRoot = () => {
	const listeners = new Map();
	return {
		addEventListener(type, listener) {
			listeners.set(type, listener);
		},
		removeEventListener(type, listener) {
			if (listeners.get(type) === listener) listeners.delete(type);
		},
		contains: (element) => element.isInsideRoot,
		dispatch(type, event) {
			listeners.get(type)?.(event);
		},
		listenerCount: () => listeners.size,
	};
};

const createActionElement = (action, options = {}) => ({
	dataset: { action },
	disabled: options.disabled || false,
	isInsideRoot: options.isInsideRoot ?? true,
	getAttribute: (name) => name === 'aria-disabled' && options.ariaDisabled ? 'true' : null,
});

test('action dispatcher routes nested clicks through the command registry', () => {
	const root = createRoot();
	const calls = [];
	const commandRegistry = {
		has: (action) => action === 'undo',
		execute: (context) => calls.push(context),
	};
	const dispatcher = createActionDispatcher({ commandRegistry, root });
	dispatcher.bind();
	dispatcher.bind();

	const actionElement = createActionElement('undo');
	const event = {
		target: { closest: (selector) => selector === '[data-action]' ? actionElement : null },
	};
	root.dispatch('click', event);

	assert.equal(root.listenerCount(), 1);
	assert.deepEqual(calls, [{ action: 'undo', event }]);
	dispatcher.destroy();
	assert.equal(root.listenerCount(), 0);
});

test('action dispatcher ignores disabled, unknown, and out-of-root actions', () => {
	const root = createRoot();
	const calls = [];
	const dispatcher = createActionDispatcher({
		commandRegistry: {
			has: (action) => action === 'undo',
			execute: (context) => calls.push(context),
		},
		root,
	});
	dispatcher.bind();

	for (const actionElement of [
		createActionElement('undo', { disabled: true }),
		createActionElement('undo', { ariaDisabled: true }),
		createActionElement('undo', { isInsideRoot: false }),
		createActionElement('unknown'),
	]) {
		root.dispatch('click', {
			target: { closest: () => actionElement },
		});
	}

	assert.deepEqual(calls, []);
});
