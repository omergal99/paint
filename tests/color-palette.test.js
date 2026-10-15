import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
	COLOR_PALETTE_1,
	COLOR_PALETTE_2,
	COLOR_PALETTE_3,
	COLOR_PALETTE_4,
	COLOR_PALETTES,
	COLOR_PALETTE_MAX,
	PALETTE_PAGE_IDS,
	RIBBON_PALETTE_COLOR_COUNT,
	colorPalettePreset,
	extendedPickerColors,
	hexToRgb,
	hexToHsl,
	hslToHex,
	migrateLegacyPalette,
	normalizePalettePage,
	sortColorsByLightness,
	withLightness,
	withSaturation,
} from '../js/utils/color.js';
import { createColorPalette } from '../js/ui/ColorPalette.js';

test('HSL conversion round-trips pure colours and reports hue/saturation/lightness', () => {
	assert.deepEqual(hexToHsl('#ff0000'), { h: 0, s: 100, l: 50 });
	assert.deepEqual(hexToHsl('#808080'), { h: 0, s: 0, l: 50 });
	assert.equal(hexToHsl('not-a-colour'), null);
	for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#000000', '#ffffff', '#808080']) {
		assert.equal(hslToHex(hexToHsl(hex)), hex, `${hex} survives the HSL round trip`);
	}
});

test('saturation and lightness helpers keep the other channels intact', () => {
	assert.equal(withSaturation('#808080', 100), '#ff0000', 'a grey gains hue 0 saturation');
	assert.equal(withLightness('#ff0000', 0), '#000000');
	assert.equal(withLightness('#ff0000', 100), '#ffffff');
	assert.equal(withSaturation('garbage', 50), 'garbage', 'invalid input is returned unchanged');
});

test('the default palette is the curated 3-row grid, free of duplicates', () => {
	// The ribbon grid is 3 x 10 = 30 cells: 28 colour swatches plus the two
	// trailing pager arrows that cycle the built-in palettes.
	assert.equal(RIBBON_PALETTE_COLOR_COUNT, 28, 'each page contributes 28 colour cells');
	assert.equal(COLOR_PALETTE_MAX, 30, '28 colours plus the 2 pager arrows fill the 3x10 grid');
	assert.equal(COLOR_PALETTE_MAX, RIBBON_PALETTE_COLOR_COUNT + 2);
	for (const [id, colors] of Object.entries({ p1: COLOR_PALETTE_1, p2: COLOR_PALETTE_2, p3: COLOR_PALETTE_3, p4: COLOR_PALETTE_4 })) {
		assert.equal(colors.length, RIBBON_PALETTE_COLOR_COUNT, `${id} fills the grid exactly`);
		assert.equal(new Set(colors).size, colors.length, `${id} has no duplicate swatches`);
		for (const hex of colors) assert.match(hex, /^#[0-9a-f]{6}$/);
	}
	assert.deepEqual(PALETTE_PAGE_IDS, ['p1', 'p2', 'p3', 'p4']);
	assert.equal(COLOR_PALETTES.length, PALETTE_PAGE_IDS.length, 'every page id has a palette');
	assert.deepEqual(COLOR_PALETTES, [COLOR_PALETTE_1, COLOR_PALETTE_2, COLOR_PALETTE_3, COLOR_PALETTE_4]);
});

test('the extended picker spans every built-in palette without repeats from 3-4', () => {
	const extended = COLOR_PALETTES.flat();
	// The extended grid has no arrows, so it spans 4 pages x 28 colour cells.
	assert.equal(extended.length, RIBBON_PALETTE_COLOR_COUNT * PALETTE_PAGE_IDS.length, 'the sidebar picker shows all 112 cells');
	// Palettes 1 and 2 legitimately share black/white/grey (palette 2 is the
	// verbatim classic MS Paint palette), but 3-4 must add only new colours.
	const firstTwo = new Set([...COLOR_PALETTE_1, ...COLOR_PALETTE_2]);
	for (const hex of [...COLOR_PALETTE_3, ...COLOR_PALETTE_4]) {
		assert.ok(!firstTwo.has(hex), `${hex} is new relative to palettes 1-2`);
	}
	assert.equal(new Set([...COLOR_PALETTE_3, ...COLOR_PALETTE_4]).size, 56, 'palettes 3-4 do not repeat each other');
});

test('the sidebar picker orders every palette on one dark-to-light ramp', () => {
	const sorted = extendedPickerColors();
	assert.equal(sorted.length, 109, 'all built-in swatches, de-duplicated across pages');
	assert.equal(new Set(sorted).size, sorted.length, 'no duplicate swatches');
	const luminance = (hex) => {
		const { r, g, b } = hexToRgb(hex);
		return 0.2126 * r + 0.7152 * g + 0.0722 * b;
	};
	for (let i = 1; i < sorted.length; i += 1) {
		assert.ok(
			luminance(sorted[i - 1]) <= luminance(sorted[i]),
			`${sorted[i - 1]} is not lighter than ${sorted[i]}`,
		);
	}
	// Pure helpers are non-mutating, so the curated page arrays keep their order.
	assert.equal(COLOR_PALETTE_1[0], '#000000', 'the curated palette still starts at black');
	assert.equal(COLOR_PALETTE_1.length, RIBBON_PALETTE_COLOR_COUNT, 'sorting never mutates the page');
	assert.deepEqual(sortColorsByLightness(null), [], 'invalid input degrades safely');
	assert.deepEqual(sortColorsByLightness([]), []);
});

test('the size mirrors push through the shared #custom-line-size writer', () => {
	// Regression: the brush studio writes brushState.size, and the ribbon mirror
	// used to assign #custom-line-size.value without dispatching `input`, so
	// applySize (and therefore setLineWidth) never ran and the engine kept the
	// old width until the next stroke. See Toolbar._syncLineSizeMirror.
	const toolbar = readFileSync(new URL('../js/ui/Toolbar.js', import.meta.url), 'utf8');
	assert.match(toolbar, /customSize\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/);
	assert.equal((toolbar.match(/_syncLineSizeMirror\(/g) || []).length, 3, 'the helper plus both mirror call sites');
	assert.doesNotMatch(toolbar, /customSize\.value = String\(state\.size\)/, 'no bare value assignment left behind');
});

test('the size mirror never re-enters applySize before the style store loads', () => {
	// Regression: _bindBrushOptions runs in the constructor *before*
	// `this._styles = this._loadStyles()`, and applySize reads `this._styles[key]`.
	// An unconditional dispatch re-entered it with no styles loaded, throwing
	// "Cannot read properties of undefined (reading 'select')" on every boot and
	// writing a duplicate style-history entry.
	const toolbar = readFileSync(new URL('../js/ui/Toolbar.js', import.meta.url), 'utf8');
	assert.match(toolbar, /if \(this\._styles\) customSize\.dispatchEvent/, 'the dispatch is gated on the loaded store');
	// The ordering itself is load-bearing: the bind runs first, so only the guard
	// keeps construction safe. Assert both steps still exist.
	assert.ok(toolbar.includes('this._bindBrushOptions();'), 'the brush bind still runs during construction');
	assert.ok(toolbar.includes('this._styles = this._loadStyles();'), 'the style store still loads during construction');
});

test('the brush studio heading offers a reset back to the default brush', () => {
	const mirror = readFileSync(new URL('../js/ui/mirrors/toolsMirror.js', import.meta.url), 'utf8');
	assert.match(mirror, /'brush-studio-reset'/, 'the reset button is tagged');
	assert.match(mirror, /brushState\?\.reset\?\.\(\)/, 'the button calls the brush state reset');
});

test('pager arrows resolve the page for built-in and edited palettes', () => {
	assert.equal(normalizePalettePage('p3', [...COLOR_PALETTE_3]), 'p3', 'a stored page id is kept');
	assert.equal(normalizePalettePage(undefined, [...COLOR_PALETTE_2]), 'p2', 'a missing page falls back to the palette match');
	assert.equal(normalizePalettePage('bogus', [...COLOR_PALETTE_4]), 'p4');
	assert.equal(normalizePalettePage('nonsense', ['#123456', '#abcdef']), 'p1', 'an edited palette with no match starts at p1');
	assert.equal(colorPalettePreset([...COLOR_PALETTE_3]), 'p3');
	assert.equal(colorPalettePreset([...COLOR_PALETTE_4]), 'p4');
});

test('the palette migration upgrades retired defaults but keeps custom colours', () => {
	assert.deepEqual(migrateLegacyPalette([...COLOR_PALETTE_2]), [...COLOR_PALETTE_1]);
	const custom = ['#111111', '#222222'];
	assert.equal(migrateLegacyPalette(custom), custom, 'custom palettes are returned untouched');
	assert.equal(migrateLegacyPalette(undefined), undefined);
	assert.notEqual(migrateLegacyPalette([...COLOR_PALETTE_2]), COLOR_PALETTE_2);
});

test('palette presets are recognised so the settings switcher can mark the active one', () => {
	assert.equal(colorPalettePreset([...COLOR_PALETTE_1]), 'p1');
	assert.equal(colorPalettePreset([...COLOR_PALETTE_2]), 'p2');
	assert.equal(colorPalettePreset(['#123456', '#abcdef']), null, 'edited palettes match no preset');
});

test('palette grids delegate swatch and pager events from stable roots', () => {
	const paletteSource = readFileSync(new URL('../js/ui/ColorPalette.js', import.meta.url), 'utf8');
	const swatchFactory = paletteSource.match(/const createSwatchButton =[\s\S]*?\n  };/)?.[0] || '';
	const pagerFactory = paletteSource.match(/const createPagerArrow =[\s\S]*?\n  };/)?.[0] || '';
	const gridBinding = paletteSource.match(/const bindGrid =[\s\S]*?\n  };/)?.[0] || '';

	assert.match(swatchFactory, /button\.dataset\.slotIndex = String\(index\)/);
	assert.doesNotMatch(swatchFactory, /addEventListener/);
	assert.doesNotMatch(pagerFactory, /addEventListener/);
	assert.match(gridBinding, /grid\.addEventListener\('click', onClick\)/);
	assert.match(gridBinding, /grid\.addEventListener\('contextmenu', onContextMenu\)/);
	assert.match(paletteSource, /const unbindGrid =[\s\S]*?grid\.removeEventListener\('click'/);
	assert.match(paletteSource, /const unmountGrid = \(grid\) => \{[\s\S]*?unbindGrid\(grid\)/);
});

test('the active foreground swatch is mirrored onto every grid and survives reload', () => {
	// W4-14: the ribbon grid had no selected-swatch highlight, so the chosen
	// colour looked unselected after a reload. The controller now mirrors the
	// primary onto the matching swatch (one write path, one highlight rule).
	const paletteSource = readFileSync(new URL('../js/ui/ColorPalette.js', import.meta.url), 'utf8');
	assert.match(paletteSource, /const syncSwatchSelection = \(grid\) => \{/);
	assert.match(paletteSource, /button\.classList\.toggle\('active', active\)/);
	assert.match(paletteSource, /button\.setAttribute\('aria-pressed', String\(active\)\)/);
	// The sync runs on mount, on grid render, and on every foreground write.
	assert.match(paletteSource, /renderGridInto\(grid, mode\);\s*\n\s*syncSwatchSelection\(grid\);/);
	assert.match(paletteSource, /syncAllSwatchSelection\(\);[\s\S]*onPrimaryChange\?\./);
	assert.match(readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8'), /\.palette-grid button\[aria-pressed="true"\]/);
});

test('a canvas background colour change repaints the clean blank surface (W4-17)', () => {
	// W4-17: on reload the canvas kept the white it was constructed with until
	// something resized it, because setBackgroundColor only stored the value.
	const manager = readFileSync(new URL('../js/canvas/CanvasManager.js', import.meta.url), 'utf8');
	const setter = manager.match(/setBackgroundColor\(color\) \{[\s\S]*?\n  \}/)?.[0] || '';
	assert.match(setter, /this\.clear\(this\.backgroundColor\)/);
	assert.match(setter, /this\.backgroundMode !== 'transparent'/);
	assert.match(setter, /this\.isCleanDocument\?\.\(\) === true/);
	// Hydration re-applies the colour after the mode is known so reload paints it.
	const hydration = readFileSync(new URL('../js/app/settingsHydration.js', import.meta.url), 'utf8');
	assert.match(hydration, /applyCanvasBackgroundMode\(bgSelect\.value\);[\s\S]*?isCleanDocument\?\.\(\) === true[\s\S]*?setBackgroundColor\(solidColor\)/);
});

test('Sidebar custom palette color inputs delegate updates through the settings grid', () => {
	const sidebarSource = readFileSync(new URL('../js/ui/Sidebar.js', import.meta.url), 'utf8');
	const renderSettingsGrid = sidebarSource.match(/const renderSettingsGrid = \(\) => \{[\s\S]*?\n\t\t\};/)?.[0] || '';
	const inputHandler = sidebarSource.match(/grid\.addEventListener\('input', \(event\) => \{[\s\S]*?\n\t\t\}\);/)?.[0] || '';

	assert.match(renderSettingsGrid, /input\.dataset\.paletteIndex = String\(index\)/);
	assert.doesNotMatch(renderSettingsGrid, /addEventListener/);
	assert.match(inputHandler, /input\[data-palette-index\]/);
	assert.match(inputHandler, /grid\.contains\(input\)/);
	assert.match(inputHandler, /next\[index\] = input\.value/);
	assert.match(inputHandler, /this\.palette\.setPalette\(next\)/);
});

// --- W4-14: the persisted palette page must survive a reload -----------
// The stubs below are just enough for createColorPalette to construct, render
// its ribbon grid and persist. `restore()` reinstalls them so a second
// construct behaves like a page reload against the same localStorage.
const makeClassList = () => {
	const set = new Set();
	return {
		add: (...names) => names.forEach((name) => set.add(name)),
		remove: (...names) => names.forEach((name) => set.delete(name)),
		toggle: (name, force) => {
			if (force === undefined) {
				if (set.has(name)) set.delete(name); else set.add(name);
				return;
			}
			if (force) set.add(name); else set.delete(name);
		},
		contains: (name) => set.has(name),
	};
};

// Minimal element factory shared by the localStorage/document stubs below and
// the ribbon grid used in buildPalette.
const makeElement = () => ({
	children: [],
	style: {},
	dataset: {},
	attrs: {},
	classList: makeClassList(),
	innerHTML: '',
	textContent: '',
	title: '',
	type: '',
	value: '',
	isConnected: true,
	setAttribute(name, value) { this.attrs[name] = String(value); },
	getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; },
	removeAttribute(name) { delete this.attrs[name]; },
	append(...nodes) { this.children.push(...nodes); },
	appendChild(node) { this.children.push(node); return node; },
	insertAdjacentHTML() {},
	addEventListener() {},
	removeEventListener() {},
	focus() {},
	closest() { return null; },
	matches() { return false; },
	remove() {},
	contains() { return false; },
	querySelector() { return null; },
	querySelectorAll(selector) {
		return selector.includes('data-color')
			? this.children.filter((child) => child.dataset?.color)
			: [];
	},
});

const makeDomStubs = () => {
	const store = new Map();
	return {
		store,
		restore() {
			globalThis.localStorage = {
				getItem: (key) => (store.has(key) ? store.get(key) : null),
				setItem: (key, value) => store.set(key, String(value)),
				removeItem: (key) => store.delete(key),
			};
			globalThis.document = {
				createElement: makeElement,
				createElementNS: makeElement,
				body: makeElement(),
				addEventListener() {},
				querySelector() { return null; },
				querySelectorAll() { return []; },
			};
			globalThis.CustomEvent = class CustomEvent {
				constructor(type, init) { this.type = type; this.detail = init?.detail; }
			};
			globalThis.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
		},
	};
};

// One factory call == one app load against the shared localStorage stub.
const buildPalette = () => {
	const grid = makeElement();
	const palette = createColorPalette({
		gridEl: grid,
		primarySwatchEl: { addEventListener() {}, style: {}, dataset: {} },
		secondarySwatchEl: { addEventListener() {}, style: {}, dataset: {} },
		colorPickerInput: { addEventListener() {}, value: '' },
		primaryAlphaInput: { addEventListener() {}, value: '' },
		secondaryAlphaInput: { addEventListener() {}, value: '' },
		primaryAlphaOutput: { value: '' },
		secondaryAlphaOutput: { value: '' },
		primaryTransparentButton: { addEventListener() {} },
		secondaryTransparentButton: { addEventListener() {} },
	});
	return { palette, grid };
};

const activeSwatches = (grid) => grid.children
	.filter((child) => child.classList.contains('active'))
	.map((child) => child.dataset.color);

test('W4-14: the swatch picked on a non-default page is still marked after a reload', () => {
	const { restore } = makeDomStubs();
	restore();

	// Load 1: arrow to page 2 and pick a swatch from it.
	const first = buildPalette();
	assert.equal(first.palette.setPalettePage('p2'), true);
	const picked = first.palette.getPalette()[5];
	assert.equal(first.palette.setPrimary(picked), true);
	assert.deepEqual(activeSwatches(first.grid), [picked], 'the pick is marked in the live session');

	// Load 2 (reload): same localStorage, a brand new palette instance.
	restore();
	const second = buildPalette();
	assert.equal(second.palette.palettePage, 'p2', 'the page id survives the reload');
	assert.equal(second.palette.primary, picked, 'the chosen colour survives the reload');
	assert.ok(second.grid.children.some((child) => child.dataset.color === picked),
		'the page-2 swatch is on screen, not a stale page-1 grid');
	assert.deepEqual(activeSwatches(second.grid), [picked], 'and it is marked active');
});

test('W4-14: a customised palette is never overwritten by the page restore', () => {
	const { restore } = makeDomStubs();
	restore();

	const first = buildPalette();
	assert.equal(first.palette.setPalette(['#123456', '#654321']), true);

	restore();
	const second = buildPalette();
	assert.deepEqual(second.palette.getPalette().slice(0, 2), ['#123456', '#654321'],
		'edited swatches survive the reload untouched');
});
