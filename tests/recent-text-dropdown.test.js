import assert from 'node:assert/strict';
import test from 'node:test';

import { createRecentTextDropdown } from '../js/ui/RecentTextDropdown.js';

class FakeElement {
	constructor(tagName) {
		this.tagName = tagName;
		this.children = [];
		this.attributes = new Map();
		this.listeners = new Map();
		this.textContent = '';
		this.title = '';
		this.disabled = false;
		this.dataset = {};
		this.classList = {
			add() {},
			toggle() {},
		};
	}

	append(...nodes) { nodes.forEach((node) => { this.children.push(node); node.parentNode = this; }); }
	contains(node) { return node === this || this.children.some((child) => child.contains?.(node) || child === node); }
	closest(selector) {
		let node = this;
		while (node) {
			if (selector === '.persistent-dropdown-option' && node.className === 'persistent-dropdown-option') return node;
			node = node.parentNode;
		}
		return null;
	}
	appendChild(node) { this.append(node); return node; }
	replaceChildren(...nodes) { this.children.forEach((node) => { node.parentNode = null; }); this.children = []; this.append(...nodes); }
	setAttribute(name, value) { this.attributes.set(name, value); }
	getAttribute(name) { return this.attributes.get(name) ?? null; }
	removeAttribute(name) { this.attributes.delete(name); }
	addEventListener(name, listener) { this.listeners.set(name, listener); }
	removeEventListener(name) { this.listeners.delete(name); }
	dispatch(name, details = {}) { this.listeners.get(name)?.({ target: this, preventDefault() {}, ...details }); }
	dispatchEvent(event) { this.dispatch(event.type); }
	focus() { this.focused = true; }
	scrollIntoView() {}
	remove() { this.removed = true; }
}

class FakeSelect extends FakeElement {
	constructor() {
		super('select');
		this._value = '';
	}
	get options() { return this.children; }
	get value() { return this._value; }
	set value(value) {
		this._value = this.children.some((option) => option.value === value) ? value : '';
	}
}

const createDocument = () => {
	const listeners = new Map();
	return {
		createElement: (tagName) => tagName === 'select' ? new FakeSelect() : new FakeElement(tagName),
		defaultView: { Event: class { constructor(type) { this.type = type; } } },
		addEventListener: (type, listener) => listeners.set(type, listener),
		removeEventListener: (type) => listeners.delete(type),
		dispatch: (type, details = {}) => listeners.get(type)?.({ target: null, ...details }),
	};
};

test('recent-text dropdown retains names and titles for full text in custom options', () => {
	const selected = [];
	const documentRef = createDocument();
	const dropdown = createRecentTextDropdown({
		documentRef,
		label: 'Restore recent text',
		labelId: 'text-history-label',
		placeholder: 'Recent text…',
		onSelect: (entry) => selected.push(entry),
	});
	const control = dropdown.control;
	const select = control.source;
	const root = dropdown.element;
	const entry = {
		id: 'entry-1',
		text: 'A very long recent text value that exceeds the preview limit so the option preview is truncated while its title keeps all of the original content.',
	};

	dropdown.setEntries([entry]);
	assert.equal(root.tagName, 'div');
	assert.equal(root.id, 'text-history-select');
	assert.equal(root.getAttribute('name'), 'textHistorySelect');
	assert.equal(control.trigger.getAttribute('aria-labelledby'), 'text-history-label');
	assert.equal(control.title, 'Recent text…');
	assert.equal(control.listbox.children[1].title, entry.text);
	assert.match(control.listbox.children[1].textContent, /…$/);
	assert.equal(control.listbox.listeners.size, 1, 'the listbox owns one delegated option listener');
	assert.equal(control.listbox.children[1].listeners.size, 0, 'rendered options own no click listeners');

	control.setValue(entry.id);
	assert.equal(control.title, entry.text);
	assert.deepEqual(selected, [entry]);

	dropdown.setEntries([entry, { id: 'entry-2', text: 'Another entry' }]);
	assert.equal(select.value, entry.id, 'rerendering entries preserves the active choice');
	assert.equal(control.title, entry.text);
	control.trigger.dispatch('click');
	assert.equal(control.listbox.hidden, false);
	const anotherEntry = { id: 'entry-2', text: 'Another entry' };
	dropdown.setEntries([entry, anotherEntry]);
	control.listbox.dispatch('click', { target: control.listbox.children[2] });
	assert.deepEqual(selected.at(-1), anotherEntry, 'delegated clicks select the current rendered option');
	assert.equal(control.listbox.hidden, true);
	assert.equal(control.trigger.focused, true);
	control.trigger.dispatch('click');
	control.trigger.dispatch('blur');
	assert.equal(control.listbox.hidden, false, 'focus loss does not collapse the options');
	control.trigger.dispatch('keydown', { key: 'Escape' });
	assert.equal(control.listbox.hidden, true, 'Escape is an explicit close action');
	control.trigger.dispatch('click');
	documentRef.dispatch('pointerdown', { target: new FakeElement('button') });
	assert.equal(control.listbox.hidden, true, 'an outside pointer press closes the dropdown');
	dropdown.destroy();
	assert.equal(control.listbox.listeners.size, 0, 'destroy removes the delegated option listener');
	assert.equal(root.removed, true);
});

test('recent-text dropdown remains enabled only when history has entries', () => {
	const dropdown = createRecentTextDropdown({
		documentRef: createDocument(),
		label: 'Restore recent text',
		placeholder: 'Recent text…',
	});
	const control = dropdown.control;

	dropdown.setEntries([]);
	assert.equal(control.disabled, true);
	dropdown.setEntries([{ id: 'entry-1', text: 'Earlier text' }]);
	assert.equal(control.disabled, false);
	assert.equal(control.title, 'Recent text…');
	dropdown.destroy();
});

test('opening a persistent dropdown closes the previously open dropdown', () => {
	const first = createRecentTextDropdown({
		documentRef: createDocument(),
		label: 'First',
		placeholder: 'First',
	});
	const second = createRecentTextDropdown({
		documentRef: createDocument(),
		label: 'Second',
		placeholder: 'Second',
	});
	first.setEntries([{ id: 'one', text: 'One' }]);
	second.setEntries([{ id: 'two', text: 'Two' }]);
	first.control.trigger.dispatch('click');
	assert.equal(first.control.listbox.hidden, false);
	second.control.trigger.dispatch('click');
	assert.equal(first.control.listbox.hidden, true);
	assert.equal(second.control.listbox.hidden, false);
	first.destroy();
	second.destroy();
});
