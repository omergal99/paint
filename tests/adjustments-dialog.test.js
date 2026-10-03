import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdjustmentsDialog } from '../js/ui/AdjustmentsDialog.js';

class FakeControl {
	constructor({ value = '', dataset = {}, options = [] } = {}) {
		this.value = value;
		this.dataset = dataset;
		this.options = options;
		this.listeners = new Map();
		this.attributes = new Map();
		this.disabled = false;
		this.hidden = false;
		this.open = false;
	}
	addEventListener(type, listener) {
		const listeners = this.listeners.get(type) || new Set();
		listeners.add(listener);
		this.listeners.set(type, listeners);
	}
	removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
	dispatchEvent(event) {
		for (const listener of this.listeners.get(event.type) || []) listener(event);
		return !event.defaultPrevented;
	}
	setAttribute(name, value) { this.attributes.set(name, value); }
	focus() { this.focused = true; }
	showModal() { this.open = true; }
	close() {
		this.open = false;
		this.dispatchEvent({ type: 'close', defaultPrevented: false });
	}
}

class FakeEvent {
	constructor(type, { cancelable = false } = {}) {
		this.type = type;
		this.cancelable = cancelable;
		this.defaultPrevented = false;
	}
	preventDefault() {
		if (this.cancelable) this.defaultPrevented = true;
	}
}

test('adjustment number input, range, and segmented scope stay synchronized', () => {
	const previousRaf = globalThis.requestAnimationFrame;
	const previousCancelRaf = globalThis.cancelAnimationFrame;
	let nextFrame = 0;
	globalThis.requestAnimationFrame = () => ++nextFrame;
	globalThis.cancelAnimationFrame = () => {};
	try {
		const selectionAvailable = { value: false };
		const maskAvailable = { value: false };
		const dialogElement = new FakeControl();
		const adjustmentSelect = new FakeControl({ value: 'brightness' });
		const targetSelect = new FakeControl({
			value: 'document',
			options: ['document', 'selection', 'brushArea'].map((value) => ({ value, disabled: false })),
		});
		targetSelect.ownerDocument = { defaultView: { Event: FakeEvent } };
		const valueInput = new FakeControl({ value: '100' });
		const valueNumberInput = new FakeControl({ value: '100' });
		const valueOutput = new FakeControl();
		const targetButtons = ['document', 'selection', 'brushArea'].map((target) => new FakeControl({
			dataset: { adjustmentTarget: target },
		}));
		const previewCanvas = {
			width: 0,
			height: 0,
			getContext: () => ({ clearRect() {}, drawImage() {} }),
		};
		const controls = {
			dialog: dialogElement,
			adjustmentSelect,
			targetSelect,
			valueInput,
			valueNumberInput,
			valueOutput,
			targetButtons,
			previewCanvas,
			applyButton: new FakeControl(),
			resetButton: new FakeControl(),
			cancelButton: new FakeControl(),
			paintMaskButton: new FakeControl(),
			clearMaskButton: new FakeControl(),
			invertMaskButton: new FakeControl(),
			apply: () => true,
			preview: () => ({ width: 1, height: 1 }),
			hasSelection: () => selectionAvailable.value,
			hasBrushMask: () => maskAvailable.value,
		};
		const controller = createAdjustmentsDialog(controls);

		valueNumberInput.value = '157';
		valueNumberInput.dispatchEvent({ type: 'input' });
		assert.equal(valueInput.value, '157');
		assert.equal(valueOutput.value, '157');

		valueInput.value = '250';
		valueInput.dispatchEvent({ type: 'input' });
		assert.equal(valueNumberInput.value, '200');
		assert.equal(valueInput.value, '200');

		selectionAvailable.value = true;
		controller.open();
		targetButtons[1].dispatchEvent({ type: 'click' });
		assert.equal(targetSelect.value, 'selection');
		assert.equal(targetButtons[1].getAttribute('aria-pressed'), 'true');
		assert.equal(controls.applyButton.disabled, false);

		targetButtons[2].dispatchEvent({ type: 'click' });
		assert.equal(targetSelect.value, 'brushArea');
		assert.equal(controls.applyButton.disabled, true);
		maskAvailable.value = true;
		controller.refresh();
		controls.dialog.close();
		controller.destroy();
	} finally {
		globalThis.requestAnimationFrame = previousRaf;
		globalThis.cancelAnimationFrame = previousCancelRaf;
	}
});
