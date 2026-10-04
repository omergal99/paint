import assert from 'node:assert/strict';
import test from 'node:test';

import { BRUSH_EXAMPLE_GRIDS, brushExampleInputValue, brushExampleValueLabel } from '../js/tools/BrushExamples.js';
import {
	BRUSH_BLEND_MODE_IDS,
	BRUSH_COLOR_MODE_IDS,
	createBrushState,
} from '../js/tools/BrushState.js';

const createStorage = () => {
	const values = new Map();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: (key) => values.delete(key),
	};
};

test('every example row coerces to a value BrushState actually accepts', () => {
	// Regression: the panel used `Number(raw)` for every row except blendMode, so
	// clicking a colorMode example sent Number('single') -> NaN and BrushState.set
	// threw "Invalid brush setting: colorMode" at runtime.
	const brushState = createBrushState({ storage: createStorage() });
	for (const grid of BRUSH_EXAMPLE_GRIDS) {
		if (grid.kind !== 'brush') continue;
		for (const value of grid.values) {
			const coerced = brushExampleInputValue(grid, String(value));
			assert.doesNotThrow(
				() => brushState.set({ [grid.field]: coerced }),
				`${grid.id} example ${value} is accepted by BrushState`,
			);
			assert.equal(brushState.get()[grid.field], coerced, `${grid.id} stored the coerced value`);
		}
	}
	// Mode rows keep their string id; numeric rows keep their number.
	const colorMode = BRUSH_EXAMPLE_GRIDS.find((grid) => grid.id === 'colorMode');
	assert.equal(brushExampleInputValue(colorMode, 'random'), 'random');
	assert.equal(brushExampleInputValue(BRUSH_EXAMPLE_GRIDS.find((g) => g.id === 'size'), '8'), 8);
	// Colour rows are not written through BrushState at all.
	const saturation = BRUSH_EXAMPLE_GRIDS.find((grid) => grid.id === 'saturation');
	assert.equal(saturation.kind, 'color');
});

test('every brush example grid is well formed and writes a real state field', () => {
	const state = createBrushState({ storage: createStorage() }).get();
	const ids = new Set();
	for (const grid of BRUSH_EXAMPLE_GRIDS) {
		assert.ok(!ids.has(grid.id), `grid id ${grid.id} is unique`);
		ids.add(grid.id);
		assert.match(grid.labelKey, /^ui\./);
		assert.ok(Array.isArray(grid.values) && grid.values.length >= 3, `${grid.id} has example values`);
		if (grid.kind === 'brush') {
			assert.ok(Object.hasOwn(state, grid.field), `${grid.field} is a brush state field`);
		} else {
			assert.ok(['saturation', 'lightness'].includes(grid.transform), `${grid.id} has a colour transform`);
		}
	}
});

test('the blend-mode example row mirrors the brush blend-mode SSOT', () => {
	const grid = BRUSH_EXAMPLE_GRIDS.find((entry) => entry.field === 'blendMode');
	assert.ok(grid);
	assert.deepEqual([...grid.values], [...BRUSH_BLEND_MODE_IDS]);
});

test('the colour-mode example row mirrors the stamp colour SSOT', () => {
	const grid = BRUSH_EXAMPLE_GRIDS.find((entry) => entry.field === 'colorMode');
	assert.ok(grid);
	assert.deepEqual([...grid.values], [...BRUSH_COLOR_MODE_IDS]);
	for (const value of grid.values) {
		assert.match(brushExampleValueLabel(grid, value).labelKey, /^ui\.brushColorMode/);
	}
});

test('example value labels are px/percent text or a translatable label key', () => {
	const size = BRUSH_EXAMPLE_GRIDS.find((grid) => grid.id === 'size');
	const alpha = BRUSH_EXAMPLE_GRIDS.find((grid) => grid.id === 'alpha');
	const blend = BRUSH_EXAMPLE_GRIDS.find((grid) => grid.id === 'blendMode');
	const saturation = BRUSH_EXAMPLE_GRIDS.find((grid) => grid.id === 'saturation');
	assert.deepEqual(brushExampleValueLabel(size, 16), { text: '16 px' });
	assert.deepEqual(brushExampleValueLabel(alpha, 0.5), { text: '50%' });
	assert.match(brushExampleValueLabel(blend, 'multiply').labelKey, /^ui\.brushBlend/);
	assert.deepEqual(
		brushExampleValueLabel(saturation, 55),
		{ text: '55%' },
		'colour rows already carry 0-100 percents',
	);
});
