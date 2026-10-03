import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdjustmentService } from '../js/canvas/AdjustmentService.js';

const createDocumentRef = () => ({
	createElement() {
		const canvas = {
			width: 0,
			height: 0,
			getContext() {
				return {
					filter: 'none',
					drawImage() {},
					clearRect() {},
				};
			},
		};
		return canvas;
	},
});

test('document adjustment snapshots before flattening or mutating the canvas', () => {
	const calls = [];
	const canvas = { width: 3, height: 2 };
	const service = createAdjustmentService({
		documentRef: createDocumentRef(),
		canvasManager: {
			canvas,
			width: 3,
			height: 2,
			ctx: {},
			flattenLayers() { calls.push('flatten'); },
			loadFromSource() { calls.push('load'); return true; },
		},
		historyManager: { snapshot() { calls.push('snapshot'); } },
		persistSession() { calls.push('persist'); },
	});
	assert.equal(service.apply({ id: 'brightness', value: 125 }), true);
	assert.deepEqual(calls, ['snapshot', 'flatten', 'load', 'persist']);
});

test('selection adjustment refuses to run without a selection', () => {
	const service = createAdjustmentService({
		documentRef: createDocumentRef(),
		canvasManager: {},
		historyManager: { snapshot() { assert.fail('must not snapshot'); } },
		getSelection: () => null,
	});
	assert.throws(
		() => service.apply({ id: 'brightness', value: 100, target: 'selection' }),
		/Select an area before applying this adjustment/,
	);
});
