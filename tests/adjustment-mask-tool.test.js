import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdjustmentMaskTool } from '../js/tools/AdjustmentMaskTool.js';

test('mask tool ignores hover and paints only during a pointer gesture', () => {
	const calls = [];
	const mask = {
		stroke: (options) => calls.push(options),
		clear: () => calls.push('clear'),
	};
	const selection = { x: 2, y: 3, w: 5, h: 4 };
	const tool = createAdjustmentMaskTool({ mask, getSelection: () => selection });
	const context = { canvasManager: { lineWidth: 8 } };

	tool.onMove({ x: 4, y: 5, button: 0 }, context);
	assert.equal(calls.length, 0);

	tool.onDown({ x: 4, y: 5, button: 2 }, context);
	tool.onMove({ x: 6, y: 7, button: 0 }, context);
	tool.onUp();
	tool.onMove({ x: 9, y: 9, button: 0 }, context);
	assert.deepEqual(calls.map((call) => typeof call === 'string' ? call : call.erase), [true, true]);
	assert.equal(calls[0].size, 8);
	assert.equal(calls[0].region, selection);
});

test('leaving the mask tool clears its overlay unless finish preserves it', () => {
	let clearCount = 0;
	const tool = createAdjustmentMaskTool({
		mask: { stroke() {}, clear() { clearCount += 1; } },
	});
	tool.onDeactivate();
	tool.preserveMaskOnDeactivate();
	tool.onDeactivate();
	tool.onDeactivate();
	assert.equal(clearCount, 2);
});
