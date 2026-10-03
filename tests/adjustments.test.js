import assert from 'node:assert/strict';
import test from 'node:test';

import {
	ADJUSTMENTS,
	ADJUSTMENT_PRESETS,
	applyAdjustment,
} from '../js/canvas/AdjustmentEngine.js';
import { SETTINGS_VALIDATORS } from '../js/app/settingsStore.js';

const createSource = (width, height, pixels = []) => ({
	width,
	height,
	pixels: new Uint8ClampedArray(pixels),
});

const createDocument = () => {
	const canvases = [];
	const documentRef = {
		createElement: (tagName) => {
			assert.equal(tagName, 'canvas');
			const canvas = {
				width: 0,
				height: 0,
				pixels: new Uint8ClampedArray(),
				calls: [],
				getContext: () => context,
			};
			const context = {
				filter: 'none',
				drawImage(source, ...args) {
					canvas.calls.push(['drawImage', source, ...args]);
					if (source.pixels) canvas.pixels = new Uint8ClampedArray(source.pixels);
				},
				clearRect(...args) {
					canvas.calls.push(['clearRect', ...args]);
					canvas.pixels = new Uint8ClampedArray(canvas.width * canvas.height * 4);
				},
				getImageData() {
					return { data: new Uint8ClampedArray(canvas.pixels), width: canvas.width, height: canvas.height };
				},
				putImageData(imageData, x, y) {
					canvas.calls.push(['putImageData', x, y]);
					canvas.pixels = new Uint8ClampedArray(imageData.data);
				},
				createPattern(source, repetition) {
					canvas.calls.push(['createPattern', source, repetition]);
					return { source, repetition };
				},
				set fillStyle(value) { canvas.pattern = value; },
				fillRect(...args) { canvas.calls.push(['fillRect', ...args]); },
			};
			canvases.push(canvas);
			return canvas;
		},
	};
	return { documentRef, canvases };
};

test('adjustment registry defines bounded defaults for every roadmap effect', () => {
	assert.deepEqual(Object.keys(ADJUSTMENTS), [
		'invert', 'brightness', 'contrast', 'hue', 'saturation', 'blur',
		'warmCold', 'pixelize', 'noise', 'pattern',
	]);
	for (const metadata of Object.values(ADJUSTMENTS)) {
		assert.ok(metadata.min <= metadata.defaultValue);
		assert.ok(metadata.defaultValue <= metadata.max);
	}
});

test('filter adjustments return a separate canvas and do not mutate source pixels', () => {
	const { documentRef, canvases } = createDocument();
	const source = createSource(1, 1, [40, 80, 120, 255]);
	const result = applyAdjustment(source, 'invert', {}, { documentRef });
	assert.notEqual(result, source);
	assert.equal(canvases[0].width, 1);
	assert.equal(canvases[0].height, 1);
	assert.equal(canvases[0].getContext().filter, 'invert(100%)');
	assert.deepEqual([...source.pixels], [40, 80, 120, 255]);
});

test('filter registry produces CSS filter values and clamps user values', () => {
	for (const [id, params, expected] of [
		['brightness', { value: 350 }, 'brightness(200%)'],
		['contrast', { value: 75 }, 'contrast(75%)'],
		['hue', { value: -90 }, 'hue-rotate(-90deg)'],
		['saturation', { value: 150 }, 'saturate(150%)'],
		['blur', { value: 4 }, 'blur(4px)'],
	]) {
		const { documentRef, canvases } = createDocument();
		applyAdjustment(createSource(1, 1), id, params, { documentRef });
		assert.equal(canvases[0].getContext().filter, expected);
	}
	assert.throws(() => applyAdjustment(createSource(1, 1), 'missing'), /Unknown adjustment/);
	assert.throws(() => applyAdjustment(createSource(1, 1), 'blur', { value: NaN }), /finite value/);
});

test('warm/cold adjustment moves red and blue around the neutral pivot', () => {
	const { documentRef, canvases } = createDocument();
	const source = createSource(1, 1, [100, 110, 120, 255]);
	const result = applyAdjustment(source, 'warmCold', { value: 50 }, { documentRef });
	assert.deepEqual([...result.pixels], [130, 110, 90, 255]);
	assert.deepEqual([...source.pixels], [100, 110, 120, 255]);
	assert.equal(canvases[0].calls.at(-1)[0], 'putImageData');
});

test('pixelize averages edge blocks and alpha without reading transparent RGB', () => {
	const { documentRef } = createDocument();
	const source = createSource(3, 1, [
		255, 0, 0, 255,
		0, 0, 255, 255,
		90, 100, 110, 0,
	]);
	const result = applyAdjustment(source, 'pixelize', { value: 2 }, { documentRef });
	assert.deepEqual([...result.pixels], [
		128, 0, 128, 255,
		128, 0, 128, 255,
		0, 0, 0, 0,
	]);
});

test('seeded noise is reproducible and preserves transparent pixels', () => {
	const source = createSource(2, 1, [100, 120, 140, 255, 99, 88, 77, 0]);
	const first = applyAdjustment(source, 'noise', { value: 30, seed: 2025 }, { documentRef: createDocument().documentRef });
	const second = applyAdjustment(source, 'noise', { value: 30, seed: 2025 }, { documentRef: createDocument().documentRef });
	assert.deepEqual([...first.pixels], [...second.pixels]);
	assert.deepEqual([...first.pixels.slice(4)], [99, 88, 77, 0]);
	assert.deepEqual([...source.pixels], [100, 120, 140, 255, 99, 88, 77, 0]);
});

test('pattern adjustment fills a new canvas by repeating the current image', () => {
	const { documentRef, canvases } = createDocument();
	const source = createSource(4, 3);
	const result = applyAdjustment(source, 'pattern', {}, { documentRef });
	assert.notEqual(result, source);
	assert.deepEqual(canvases[0].pattern, { source, repetition: 'repeat' });
	assert.ok(canvases[0].calls.some(([name, ...args]) => name === 'fillRect' && args.join(',') === '0,0,4,3'));
});

test('built-in adjustment presets contain valid parameters and settings reject invalid values', () => {
	assert.deepEqual(ADJUSTMENT_PRESETS, {
		warm: { warmCold: 60 },
		blackAndWhite: { saturation: 0 },
		softBlur: { blur: 2 },
	});
	assert.equal(SETTINGS_VALIDATORS.adjustParams({ warmCold: { value: 60 } }), true);
	assert.equal(SETTINGS_VALIDATORS.adjustParams({ noise: { value: 20, seed: 2 } }), true);
	assert.equal(SETTINGS_VALIDATORS.adjustParams({ blur: { value: 41 } }), false);
	assert.equal(SETTINGS_VALIDATORS.adjustParams({ arbitrary: { value: 1 } }), false);
	assert.equal(SETTINGS_VALIDATORS.adjustParams({ noise: { value: 20, seed: -1 } }), false);
});
