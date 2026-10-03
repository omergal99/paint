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
		this.value = '';
		this.disabled = false;
	}

	appendChild(node) { this.children.push(node); return node; }
	replaceChildren() { this.children = []; }
	setAttribute(name, value) { this.attributes.set(name, value); }
	getAttribute(name) { return this.attributes.get(name) ?? null; }
	addEventListener(name, listener) { this.listeners.set(name, listener); }
	removeEventListener(name) { this.listeners.delete(name); }
	dispatch(name) { this.listeners.get(name)?.({ target: this }); }
	remove() { this.removed = true; }
}

const createDocument = () => ({
	createElement: (tagName) => new FakeElement(tagName),
});

test('recent-text select has form names and preserves full text through truncated options', () => {
	const selected = [];
	const dropdown = createRecentTextDropdown({
		documentRef: createDocument(),
		label: 'Restore recent text',
		labelId: 'text-history-label',
		placeholder: 'Recent text…',
		onSelect: (entry) => selected.push(entry),
	});
	const select = dropdown.element;
	const entry = {
		id: 'entry-1',
		text: 'A very long recent text value that exceeds the preview limit so the option preview is truncated while its title keeps all of the original content.',
	};

	dropdown.setEntries([entry]);
	assert.equal(select.tagName, 'select');
	assert.equal(select.id, 'text-history-select');
	assert.equal(select.name, 'textHistorySelect');
	assert.equal(select.getAttribute('aria-labelledby'), 'text-history-label');
	assert.equal(select.title, 'Recent text…');
	assert.equal(select.children[1].title, entry.text);
	assert.match(select.children[1].textContent, /…$/);

	select.value = entry.id;
	select.dispatch('change');
	assert.equal(select.title, entry.text);
	assert.deepEqual(selected, [entry]);

	dropdown.setEntries([entry, { id: 'entry-2', text: 'Another entry' }]);
	assert.equal(select.value, entry.id, 'rerendering entries preserves the active choice');
	assert.equal(select.title, entry.text);
	dropdown.destroy();
	assert.equal(select.removed, true);
});

test('recent-text select remains enabled only when history has entries', () => {
	const dropdown = createRecentTextDropdown({
		documentRef: createDocument(),
		label: 'Restore recent text',
		placeholder: 'Recent text…',
	});
	const select = dropdown.element;

	dropdown.setEntries([]);
	assert.equal(select.disabled, true);
	dropdown.setEntries([{ id: 'entry-1', text: 'Earlier text' }]);
	assert.equal(select.disabled, false);
	assert.equal(select.title, 'Recent text…');
	dropdown.destroy();
});
