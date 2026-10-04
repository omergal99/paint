import assert from 'node:assert/strict';
import test from 'node:test';

import {
	BRUSH_BLEND_MODES,
	BRUSH_BLEND_COMPOSITE,
	BRUSH_BLEND_MODE_IDS,
} from '../js/tools/BrushState.js';
import { createBrushStrokeRenderer, textureNoise } from '../js/tools/BrushStrokeRenderer.js';

const createContext = () => ({
	globalAlpha: 1,
	globalCompositeOperation: 'source-over',
	fillStyle: '',
	stack: [],
	rects: [],
	ellipses: [],
	arcs: [],
	fills: [],
	points: [],
	save() {
		this.stack.push({
			globalAlpha: this.globalAlpha,
			globalCompositeOperation: this.globalCompositeOperation,
			fillStyle: this.fillStyle,
		});
	},
	restore() { Object.assign(this, this.stack.pop()); },
	fillRect(x, y, width, height) {
		this.rects.push({
			x, y, width, height,
			alpha: this.globalAlpha,
			op: this.globalCompositeOperation,
			style: this.fillStyle,
		});
	},
	ellipse(x, y, rx, ry, rotation) {
		this.ellipses.push({ x, y, rx, ry, rotation, alpha: this.globalAlpha });
	},
	arc(x, y, radius) { this.arcs.push({ x, y, radius, alpha: this.globalAlpha }); },
	fill() { this.fills.push(this.globalAlpha); },
	beginPath() {},
	closePath() {},
	moveTo(x, y) { this.points.push({ x, y }); },
	lineTo(x, y) { this.points.push({ x, y }); },
	translate() {},
	rotate() {},
	createRadialGradient() { return { addColorStop() {} }; },
});

test('texture noise is a deterministic per-coordinate value in [0,1)', () => {
	assert.equal(textureNoise(3, 7), textureNoise(3, 7));
	assert.notEqual(textureNoise(3, 7), textureNoise(3, 8));
	for (let i = 0; i < 200; i += 1) {
		const value = textureNoise(i * 1.7, i * 0.3);
		assert.ok(value >= 0 && value < 1, `noise ${value} stays in range`);
	}
});

test('brush blend modes expose one composite map for the panel, renderer, and tests', () => {
	assert.deepEqual(new Set(BRUSH_BLEND_MODE_IDS).size, BRUSH_BLEND_MODES.length, 'mode ids are unique');
	assert.equal(BRUSH_BLEND_COMPOSITE.normal, 'source-over');
	assert.equal(BRUSH_BLEND_COMPOSITE.multiply, 'multiply');
	for (const mode of BRUSH_BLEND_MODES) {
		assert.match(mode.labelKey, /^ui\.brushBlend/);
		assert.equal(BRUSH_BLEND_COMPOSITE[mode.id], mode.composite);
	}
});

test('a plain round brush still draws the axis-aligned arc stamp (no new fields)', () => {
	const context = createContext();
	const renderer = createBrushStrokeRenderer(context, {
		size: 10, spacing: 0.5, hardness: 1, flow: 1, tipShape: 'round',
	});
	renderer.drawTo({ x: 0, y: 0 });
	assert.equal(context.ellipses.length, 0);
	assert.deepEqual(context.arcs.map((arc) => arc.radius), [5]);
});

test('roundness renders an elliptical tip and scatter offsets the stamp', () => {
	const context = createContext();
	const renderer = createBrushStrokeRenderer(context, {
		size: 20, spacing: 0.5, hardness: 1, flow: 1, tipShape: 'round', roundness: 0.5,
	});
	renderer.drawTo({ x: 0, y: 0 });
	assert.equal(context.ellipses.length, 1);
	assert.equal(context.ellipses[0].rx, 5, 'horizontal radius is scaled by roundness');
	assert.equal(context.ellipses[0].ry, 10);

	const scattered = createContext();
	const scatterRenderer = createBrushStrokeRenderer(scattered, {
		size: 20, spacing: 0.5, hardness: 1, flow: 1, tipShape: 'square', scatter: 1,
	}, { random: () => 0.75 });
	scatterRenderer.drawTo({ x: 0, y: 0 });
	assert.equal(scattered.rects[0].x, -5, 'scatter pushes the stamp toward the offset');
	assert.equal(scattered.rects[0].width, 20);
});

test('rotation jitter rotates the tip inside the configured jitter range', () => {
	const context = createContext();
	const renderer = createBrushStrokeRenderer(context, {
		size: 20, spacing: 0.5, hardness: 1, flow: 1, tipShape: 'round',
		roundness: 0.5, angle: 0, angleJitter: 1,
	}, { random: () => 1 });
	renderer.drawTo({ x: 0, y: 0 });
	assert.ok(Math.abs(context.ellipses[0].rotation - Math.PI) < 1e-9);
});

test('texture reduces the stamp alpha deterministically and blend mode is applied', () => {
	const context = createContext();
	const renderer = createBrushStrokeRenderer(context, {
		size: 20, spacing: 0.5, hardness: 1, flow: 1, tipShape: 'square', texture: 1,
	}, { color: '#000000', alpha: 1 });
	renderer.drawTo({ x: 0, y: 0 });
	const expected = 1 * (1 - 1 * textureNoise(0, 0));
	assert.ok(expected < 1, 'the origin is not a full-alpha texture stamp');
	assert.ok(Math.abs(context.rects[0].alpha - expected) < 1e-12);
	assert.equal(context.rects[0].op, 'source-over', 'normal blending leaves the composite op untouched');

	const blended = createContext();
	const blendRenderer = createBrushStrokeRenderer(blended, {
		size: 20, spacing: 0.5, hardness: 1, flow: 1, tipShape: 'square', blendMode: 'multiply',
	}, { color: '#000000', alpha: 1 });
	blendRenderer.drawTo({ x: 0, y: 0 });
	assert.equal(blended.rects[0].op, 'multiply', 'the stamp uses the configured blend mode');
	assert.equal(blended.globalCompositeOperation, 'source-over', 'save/restore resets the composite op');
});

test('the diamond tip matches the square tip rotated 45 degrees (same footprint, pointer-accurate)', () => {
	const context = createContext();
	const renderer = createBrushStrokeRenderer(context, {
		size: 20, spacing: 0.5, hardness: 1, flow: 1, tipShape: 'diamond',
	});
	renderer.drawTo({ x: 0, y: 0 });
	assert.equal(context.rects.length, 0, 'the diamond is a path, not a fillRect');
	assert.ok(context.points.length >= 4, 'the diamond records its four vertices');
	const [first] = context.points;
	assert.ok(Math.abs(first.x - 0) < 1e-9, 'the top vertex stays centred');
	assert.ok(
		Math.abs(first.y + 10 * Math.SQRT2) < 1e-9,
		'half-diagonal is r*sqrt(2): the size x size square rotated 45 degrees',
	);
});

test('stamp colours follow the single/random/series modes', () => {
	const series = createContext();
	const seriesRenderer = createBrushStrokeRenderer(series, {
		size: 10, spacing: 0.5, hardness: 1, flow: 1, tipShape: 'square',
		colorMode: 'series', colors: ['#ff0000', '#00ff00'],
	}, { color: '#0000ff', alpha: 1 });
	seriesRenderer.drawTo({ x: 0, y: 0 });
	seriesRenderer.drawTo({ x: 10, y: 0 });
	assert.equal(series.rects[0].style, '#ff0000', 'series starts at the first colour');
	assert.equal(series.rects[1].style, '#00ff00', 'each stamp advances the series');

	const random = createContext();
	const randomRenderer = createBrushStrokeRenderer(random, {
		size: 10, spacing: 0.5, hardness: 1, flow: 1, tipShape: 'square',
		colorMode: 'random', colors: ['#ff0000', '#00ff00'],
	}, { color: '#0000ff', alpha: 1, random: () => 0 });
	randomRenderer.drawTo({ x: 0, y: 0 });
	assert.ok(random.rects.length >= 1);
	assert.ok(
		random.rects.every((stamp) => stamp.style === '#ff0000'),
		'random mode picks from the colour set, never the stroke colour',
	);

	const single = createContext();
	const singleRenderer = createBrushStrokeRenderer(single, {
		size: 10, spacing: 0.5, hardness: 1, flow: 1, tipShape: 'square',
		colorMode: 'series', colors: ['#ff0000'],
	}, { color: '#0000ff', alpha: 1 });
	singleRenderer.drawTo({ x: 0, y: 0 });
	assert.equal(single.rects[0].style, '#0000ff', 'one selected colour falls back to the stroke colour');
});

test('random shape walks the shared tip table per stamp', () => {
	const round = createContext();
	const roundRenderer = createBrushStrokeRenderer(round, {
		size: 10, spacing: 0.5, hardness: 1, flow: 1, tipShape: 'square',
		randomShape: true,
	}, { color: '#000000', alpha: 1, random: () => 0 });
	roundRenderer.drawTo({ x: 0, y: 0 });
	assert.equal(round.rects.length, 0, 'random() = 0 resolves the first tip (round)');
	assert.equal(round.arcs.length, 1);

	const square = createContext();
	const squareRenderer = createBrushStrokeRenderer(square, {
		size: 10, spacing: 0.5, hardness: 1, flow: 1, tipShape: 'round',
		randomShape: true,
	}, { color: '#000000', alpha: 1, random: () => 0.4 });
	squareRenderer.drawTo({ x: 0, y: 0 });
	assert.equal(square.arcs.length, 0, 'random() = 0.4 resolves square (BRUSH_TIP_OPTIONS[1])');
	assert.equal(square.rects.length, 1);
	assert.equal(square.rects[0].width, 10);
});
