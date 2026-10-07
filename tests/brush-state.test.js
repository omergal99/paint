import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createBrushState, BRUSH_STATE_SCHEMA_VERSION } from '../js/tools/BrushState.js';
import { createBrushTool, createEraserTool, createPencilTool } from '../js/tools/FreehandTools.js';
import { createBrushStrokeRenderer } from '../js/tools/BrushStrokeRenderer.js';

const createStorage = () => {
	const values = new Map();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: (key) => values.delete(key),
	};
};

test('brush state persists validated settings and notifies subscribers', () => {
	const storage = createStorage();
	const brushState = createBrushState({ storage });
	const updates = [];
	const unsubscribe = brushState.subscribe((state) => updates.push(state));

	brushState.set({ size: 42, alpha: 0.7, flow: 0.35 });
	assert.deepEqual(brushState.get(), {
		size: 42,
		alpha: 0.7,
		flow: 0.35,
		hardness: 1,
		spacing: 0.2,
		tipShape: 'round',
		stabilizer: 0,
		style: 'round',
		roundness: 1,
		angle: 0,
		angleJitter: 0,
		scatter: 0,
		texture: 0,
		blendMode: 'normal',
		colorMode: 'single',
		colors: [],
		randomShape: false,
		presets: [],
		history: [],
		dynamics: { pressureSize: false, pressureFlow: false, speedSize: 0, speedFlow: 0 },
	});
	assert.equal(updates.length, 1);
	assert.equal(JSON.parse(storage.getItem('paint:brush')).schemaVersion, BRUSH_STATE_SCHEMA_VERSION);

	const restored = createBrushState({ storage });
	assert.deepEqual(restored.get(), brushState.get());
	brushState.set({
		presets: [{ id: 'saved', name: 'Saved', size: 12 }],
		history: [{ size: 12, color: '#123456' }],
		dynamics: { pressureSize: true, speedFlow: 0.4 },
	});
	assert.deepEqual(createBrushState({ storage }).get(), brushState.get());
	unsubscribe();
});

test('brush state rejects invalid fields and ignores unsupported persisted schemas', () => {
	const storage = createStorage();
	storage.setItem('paint:brush', JSON.stringify({ schemaVersion: 99, size: 88 }));
	const brushState = createBrushState({ storage });
	assert.equal(brushState.get().size, 3);
	assert.equal(brushState.set({ size: 0 }).size, 1, 'brush sizes clamp to their valid minimum');
	assert.equal(brushState.set({ spacing: 3 }).spacing, 2, 'spacing is clamped to its supported maximum');
	assert.equal(brushState.set({ hardness: -1 }).hardness, 0, 'hardness is clamped to its supported minimum');
	assert.throws(() => brushState.set({ flow: 'invalid' }), /Invalid brush setting/);
	assert.throws(() => brushState.set({ tipShape: 'triangle' }), /Invalid brush setting/);
	assert.throws(() => brushState.set({ invented: true }), /Unknown brush setting/);
	assert.equal(brushState.set({ roundness: 0 }).roundness, 0.05, 'roundness is clamped to its supported minimum');
	assert.equal(brushState.set({ angle: 720 }).angle, 360, 'angle is clamped to a full turn');
	assert.equal(brushState.set({ scatter: 5 }).scatter, 1, 'scatter is clamped to 0-1');
	assert.equal(brushState.set({ blendMode: 'multiply' }).blendMode, 'multiply');
	assert.throws(() => brushState.set({ blendMode: 'invented' }), /Invalid brush setting/);
	// Stamp colour sets + random shape (Phase 5 finalization).
	assert.equal(brushState.set({ colorMode: 'series' }).colorMode, 'series');
	assert.throws(() => brushState.set({ colorMode: 'invented' }), /Invalid brush setting/);
	assert.deepEqual(
		brushState.set({ colors: ['#FF0000', 'not-a-colour', '#00ff00'] }).colors,
		['#ff0000', '#00ff00'],
		'colour sets keep only valid lower-cased hex values',
	);
	assert.equal(brushState.set({ randomShape: true }).randomShape, true);
	assert.throws(() => brushState.set({ randomShape: 'yes' }), /Invalid brush setting/);
});

test('custom preset rename controls delegate events through the Brush Studio root', () => {
	const source = readFileSync(new URL('../js/ui/BrushStudioPanel.js', import.meta.url), 'utf8');
	const renderPreset = source.match(/const updatePresetAndHistory =[\s\S]*?\n\t\t};/)?.[0] || '';
	const eventHandlers = source.match(/host\.addEventListener\('keydown'[\s\S]*?host\.addEventListener\('click'/)?.[0] || '';

	assert.doesNotMatch(renderPreset, /addEventListener/);
	assert.match(eventHandlers, /host\.addEventListener\('keydown'/);
	assert.match(eventHandlers, /event\.key === 'Enter'[\s\S]*?finishPresetRename\(input, true\)/);
	assert.match(eventHandlers, /event\.key === 'Escape'[\s\S]*?finishPresetRename\(input, false\)/);
	assert.match(eventHandlers, /host\.addEventListener\('focusout'/);
	assert.match(eventHandlers, /host\.addEventListener\('dblclick'/);
	assert.match(source, /beginPresetRename\(button\.closest\('\.brush-studio-custom-preset'\)\)/);
});

test('brush opacity and flow affect strokes without changing pencil or eraser behavior', () => {
	const context = {
		canvas: {},
		beginPath() {},
		moveTo() {},
		lineTo() {},
		stroke() { this.strokes += 1; },
		fillRect() { this.alphas.push(this.globalAlpha); },
		arc(x, y, radius) { this.radii.push(radius); },
		fill() { this.alphas.push(this.globalAlpha); },
		closePath() {},
		createRadialGradient() {
			return { addColorStop() {} };
		},
		save() { this.stack.push({ globalAlpha: this.globalAlpha, fillStyle: this.fillStyle }); },
		restore() { Object.assign(this, this.stack.pop()); },
		alphas: [],
		radii: [],
		strokes: 0,
		stack: [],
		globalAlpha: 1,
	};
	let snapshots = 0;
	let brushState = {
		size: 12,
		alpha: 0.5,
		flow: 0.4,
		hardness: 1,
		spacing: 0.2,
		tipShape: 'round',
		stabilizer: 0,
		dynamics: { pressureSize: false, pressureFlow: false, speedSize: 0, speedFlow: 0 },
		history: [],
	};
	const toolContext = {
		canvasManager: {
			ctx: context,
			primaryColor: '#123456',
			primaryAlpha: 0.8,
			secondaryColor: '#ffffff',
			secondaryAlpha: 0.6,
			backgroundColor: '#ffffff',
			lineWidth: 12,
		},
		historyManager: { snapshot: () => { snapshots += 1; } },
		getBrushState: () => brushState,
		setBrushState: (patch) => { brushState = { ...brushState, ...patch }; },
	};

	const brushTool = createBrushTool();
	brushTool.onDown({ x: 2, y: 3, button: 0 }, toolContext);
	assert.ok(Math.abs(context.alphas[0] - 0.16) < Number.EPSILON * 2);
	assert.equal(context.radii[0], 6, 'the selected brush size sets the stamp diameter');
	brushTool.onUp({ x: 2, y: 3, button: 0 }, toolContext);
	assert.equal(brushState.history.length, 1);
	assert.equal(brushState.history[0].color, '#123456');
	createPencilTool().onDown({ x: 2, y: 3, button: 0 }, toolContext);
	assert.equal(context.globalAlpha, 0.8);
	assert.equal(context.lineWidth, 1);
	const eraserTool = createEraserTool();
	eraserTool.onDown({ x: 2, y: 3, button: 0 }, toolContext);
	assert.equal(context.globalAlpha, 1);
	assert.equal(context.lineWidth, 12);
	assert.equal(context.strokeStyle, '#ffffff');
	eraserTool.onUp({ x: 2, y: 3, button: 0 }, toolContext);
	brushTool.onDown({ x: 2, y: 3, button: 0 }, {
		...toolContext,
		getBrushState: () => ({ alpha: 0.1, flow: 0.1 }),
	});
	assert.equal(snapshots, 4, 'one history snapshot is captured for each stroke');
});

test('brush renderer stamps by spacing and preserves per-stamp flow alpha', () => {
	const stamps = [];
	const context = {
		globalAlpha: 1,
		save() {},
		restore() {},
		fillRect(x, y, width, height) { stamps.push({ x, y, width, height, alpha: this.globalAlpha }); },
	};
	const renderer = createBrushStrokeRenderer(context, {
		size: 10,
		spacing: 0.5,
		hardness: 1,
		flow: 0.5,
		tipShape: 'square',
	}, { color: '#123456', alpha: 0.8 });
	renderer.drawTo({ x: 0, y: 0 });
	renderer.drawTo({ x: 10, y: 0 });
	assert.deepEqual(stamps.map((stamp) => stamp.x), [-5, 0, 5]);
	assert.ok(stamps.every((stamp) => stamp.width === 10 && stamp.alpha === 0.4));
});

test('brush pressure and speed dynamics adjust stamp size and opacity using pointer data', () => {
	const stamps = [];
	const context = {
		globalAlpha: 1,
		save() {},
		restore() {},
		fillRect(x, y, width, height) { stamps.push({ width, alpha: this.globalAlpha }); },
	};
	const brush = createBrushTool();
	const toolContext = {
		canvasManager: {
			ctx: context,
			primaryColor: '#123456',
			primaryAlpha: 1,
			secondaryColor: '#ffffff',
			secondaryAlpha: 1,
			lineWidth: 20,
		},
		historyManager: { snapshot() {} },
		getBrushState: () => ({
			size: 20, alpha: 1, flow: 1, hardness: 1, spacing: 0.1,
			tipShape: 'square', stabilizer: 0,
			dynamics: { pressureSize: true, pressureFlow: true, speedSize: 0, speedFlow: 0 },
		}),
	};
	brush.onDown({ x: 0, y: 0, button: 0 }, toolContext, {
		pointerType: 'pen', pressure: 0.2, timeStamp: 1,
	});
	brush.onMove({ x: 10, y: 0, button: 0 }, toolContext, {
		pointerType: 'pen', pressure: 1, timeStamp: 100,
	});
	assert.ok(stamps[0].width < stamps.at(-1).width);
	assert.ok(stamps[0].alpha < stamps.at(-1).alpha);
});
