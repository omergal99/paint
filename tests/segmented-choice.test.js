import assert from 'node:assert/strict';
import test from 'node:test';
import { createSegmentedChoice } from '../js/ui/SegmentedChoice.js';

const createClassList = () => ({
	add() {},
	toggle() {},
});

test('custom choice swaps the selected summary for its inline input', () => {
	const oldDocument = globalThis.document;
	const buttons = [];
	const choiceLabel = { hidden: false, setAttribute() {} };
	const customInputs = { hidden: true };
	const selectedLabel = { textContent: '', setAttribute() {} };
	const root = {
		dataset: { customValue: 'custom' },
		querySelector(selector) {
			if (selector === '[data-selected-label]') return selectedLabel;
			if (selector === '[data-choice-summary-label]') return choiceLabel;
			if (selector === '[data-custom-inputs]') return customInputs;
			return null;
		},
		querySelectorAll() { return [...buttons]; },
		appendChild(button) { buttons.push(button); },
	};
	const options = [
		{ value: '5000', textContent: '5 seconds' },
		{ value: 'custom', textContent: 'Custom' },
	];
	const selectListeners = new Map();
	const select = {
		value: '5000',
		options,
		get selectedIndex() { return options.findIndex((option) => option.value === this.value); },
		classList: createClassList(),
		addEventListener(type, listener) { selectListeners.set(type, listener); },
		dispatchEvent(event) { selectListeners.get(event.type)?.(event); },
	};
	globalThis.document = {
		createElement: () => ({
			dataset: {},
			classList: { toggle() {} },
			setAttribute() {},
			addEventListener() {},
			remove() { buttons.splice(buttons.indexOf(this), 1); },
		}),
	};

	try {
		const choice = createSegmentedChoice({ root, select });
		assert.equal(choiceLabel.hidden, false);
		assert.equal(customInputs.hidden, true);
		select.value = 'custom';
		select.dispatchEvent(new Event('change'));
		assert.equal(choiceLabel.hidden, true);
		assert.equal(customInputs.hidden, false);
		select.value = '5000';
		choice.render();
		assert.equal(choiceLabel.hidden, false);
		assert.equal(customInputs.hidden, true);
	} finally {
		globalThis.document = oldDocument;
	}
});
