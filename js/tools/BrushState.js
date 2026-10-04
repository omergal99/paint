import { STORAGE_KEYS } from '../core/constants.js';

export const BRUSH_STATE_SCHEMA_VERSION = 1;
export const BRUSH_STYLE_OPTIONS = Object.freeze(['round', 'calligraphic']);
export const BRUSH_TIP_OPTIONS = Object.freeze(['round', 'square', 'diamond', 'soft']);

// SSOT for stamp blending: the panel select, the renderer, and tests all read
// this one table. `composite` is the canvas `globalCompositeOperation` value.
export const BRUSH_BLEND_MODES = Object.freeze([
	Object.freeze({ id: 'normal', composite: 'source-over', labelKey: 'ui.brushBlendNormal' }),
	Object.freeze({ id: 'multiply', composite: 'multiply', labelKey: 'ui.brushBlendMultiply' }),
	Object.freeze({ id: 'darken', composite: 'darken', labelKey: 'ui.brushBlendDarken' }),
	Object.freeze({ id: 'lighten', composite: 'lighten', labelKey: 'ui.brushBlendLighten' }),
	Object.freeze({ id: 'screen', composite: 'screen', labelKey: 'ui.brushBlendScreen' }),
	Object.freeze({ id: 'overlay', composite: 'overlay', labelKey: 'ui.brushBlendOverlay' }),
	Object.freeze({ id: 'soft-light', composite: 'soft-light', labelKey: 'ui.brushBlendSoftLight' }),
	Object.freeze({ id: 'color-dodge', composite: 'color-dodge', labelKey: 'ui.brushBlendColorDodge' }),
	Object.freeze({ id: 'color-burn', composite: 'color-burn', labelKey: 'ui.brushBlendColorBurn' }),
	Object.freeze({ id: 'difference', composite: 'difference', labelKey: 'ui.brushBlendDifference' }),
]);
export const BRUSH_BLEND_MODE_IDS = Object.freeze(BRUSH_BLEND_MODES.map((mode) => mode.id));
export const BRUSH_BLEND_COMPOSITE = Object.freeze(
	Object.fromEntries(BRUSH_BLEND_MODES.map((mode) => [mode.id, mode.composite])),
);
// SSOT for stamp colour selection: `single` paints the stroke colour, `random`
// picks one of BrushState.colors per stamp, `series` cycles through them in
// order. The panel example row, the renderer, and tests all read this table.
export const BRUSH_COLOR_MODES = Object.freeze([
	Object.freeze({ id: 'single', labelKey: 'ui.brushColorModeSingle' }),
	Object.freeze({ id: 'random', labelKey: 'ui.brushColorModeRandom' }),
	Object.freeze({ id: 'series', labelKey: 'ui.brushColorModeSeries' }),
]);
export const BRUSH_COLOR_MODE_IDS = Object.freeze(BRUSH_COLOR_MODES.map((mode) => mode.id));

export const BUILT_IN_BRUSH_PRESETS = Object.freeze([
	{ id: 'pencil', name: 'Pencil', size: 2, alpha: 1, flow: 1, hardness: 1, spacing: 0.18, tipShape: 'round' },
	{ id: 'hard-round', name: 'Hard Round', size: 12, alpha: 1, flow: 1, hardness: 1, spacing: 0.2, tipShape: 'round' },
	{ id: 'soft-round', name: 'Soft Round', size: 32, alpha: 0.72, flow: 0.32, hardness: 0.15, spacing: 0.12, tipShape: 'soft' },
	{ id: 'airbrush', name: 'Airbrush', size: 48, alpha: 0.3, flow: 0.12, hardness: 0, spacing: 0.08, tipShape: 'soft' },
	{ id: 'marker', name: 'Marker', size: 18, alpha: 0.75, flow: 0.8, hardness: 0.82, spacing: 0.24, tipShape: 'square' },
]);

const DEFAULT_BRUSH_STATE = Object.freeze({
	size: 3,
	alpha: 1,
	flow: 1,
	hardness: 1,
	spacing: 0.2,
	tipShape: 'round',
	stabilizer: 0,
	style: 'round',
	// Advanced stamp controls (Phase 5 finalization): elliptical tip, stamp
	// rotation jitter, scatter, texture mask, stamp blending, per-stamp colour
	// sets (random/series), and per-stamp tip shape.
	roundness: 1,
	angle: 0,
	angleJitter: 0,
	scatter: 0,
	texture: 0,
	blendMode: 'normal',
	colorMode: 'single',
	colors: Object.freeze([]),
	randomShape: false,
	presets: Object.freeze([]),
	history: Object.freeze([]),
	dynamics: Object.freeze({
		pressureSize: false,
		pressureFlow: false,
		speedSize: 0,
		speedFlow: 0,
	}),
});

const clone = (value) => typeof structuredClone === 'function'
	? structuredClone(value)
	: JSON.parse(JSON.stringify(value));

const normalizeValue = (key, value) => {
	if (key === 'size') {
		const number = Number(value);
		return Number.isFinite(number) ? Math.max(1, Math.min(300, Math.round(number))) : null;
	}
	if (key === 'alpha' || key === 'flow') {
		const number = Number(value);
		return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : null;
	}
	if (key === 'hardness' || key === 'stabilizer') {
		const number = Number(value);
		return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : null;
	}
	if (key === 'spacing') {
		const number = Number(value);
		return Number.isFinite(number) ? Math.max(0.05, Math.min(2, number)) : null;
	}
	if (key === 'roundness') {
		const number = Number(value);
		return Number.isFinite(number) ? Math.max(0.05, Math.min(1, number)) : null;
	}
	if (key === 'angle') {
		const number = Number(value);
		return Number.isFinite(number) ? Math.max(0, Math.min(360, number)) : null;
	}
	if (key === 'angleJitter' || key === 'scatter' || key === 'texture') {
		const number = Number(value);
		return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : null;
	}
	if (key === 'blendMode') return BRUSH_BLEND_MODE_IDS.includes(value) ? value : null;
	if (key === 'colorMode') return BRUSH_COLOR_MODE_IDS.includes(value) ? value : null;
	if (key === 'randomShape') return typeof value === 'boolean' ? value : null;
	if (key === 'colors') {
		if (!Array.isArray(value)) return null;
		const valid = value
			.filter((hex) => typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex))
			.map((hex) => hex.toLowerCase());
		return clone(valid.slice(0, 30));
	}
	if (key === 'tipShape') return BRUSH_TIP_OPTIONS.includes(value) ? value : null;
	if (key === 'style') return BRUSH_STYLE_OPTIONS.includes(value) ? value : null;
	if (key === 'presets') return Array.isArray(value) ? clone(value).slice(0, 20) : null;
	if (key === 'history') return Array.isArray(value) ? clone(value).slice(0, 12) : null;
	if (key === 'dynamics') {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
		const defaults = DEFAULT_BRUSH_STATE.dynamics;
		const normalized = { ...defaults };
		for (const field of Object.keys(defaults)) {
			if (!Object.hasOwn(value, field)) continue;
			if (field === 'pressureSize' || field === 'pressureFlow') {
				if (typeof value[field] !== 'boolean') return null;
				normalized[field] = value[field];
				continue;
			}
			const number = Number(value[field]);
			if (!Number.isFinite(number)) return null;
			normalized[field] = Math.max(0, Math.min(1, number));
		}
		return normalized;
	}
	return undefined;
};

const readStoredState = (storage, key) => {
	try {
		const saved = JSON.parse(storage?.getItem(key) || 'null');
		if (!saved || saved.schemaVersion !== BRUSH_STATE_SCHEMA_VERSION) return clone(DEFAULT_BRUSH_STATE);
		const state = clone(DEFAULT_BRUSH_STATE);
		for (const field of Object.keys(DEFAULT_BRUSH_STATE)) {
			const normalized = normalizeValue(field, saved[field]);
			if (normalized !== null && normalized !== undefined) state[field] = normalized;
		}
		return state;
	} catch (error) {
		console.warn('Unable to read saved brush settings:', error);
		return clone(DEFAULT_BRUSH_STATE);
	}
};

export const createBrushState = ({
	storage = globalThis.localStorage,
	key = STORAGE_KEYS.brushState,
} = {}) => {
	let state = readStoredState(storage, key);
	const listeners = new Set();

	const get = () => clone(state);

	const persist = () => {
		try {
			storage?.setItem(key, JSON.stringify({
				schemaVersion: BRUSH_STATE_SCHEMA_VERSION,
				...state,
			}));
		} catch (error) {
			console.warn('Unable to persist brush settings:', error);
		}
	};

	const notify = () => {
		const snapshot = get();
		listeners.forEach((listener) => listener(snapshot));
	};

	const set = (patch) => {
		if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
			throw new TypeError('Brush state updates must be an object');
		}
		const next = { ...state };
		for (const [field, value] of Object.entries(patch)) {
			if (!Object.hasOwn(DEFAULT_BRUSH_STATE, field)) {
				throw new TypeError(`Unknown brush setting: ${field}`);
			}
			const normalized = normalizeValue(field, value);
			if (normalized === null || normalized === undefined) {
				throw new TypeError(`Invalid brush setting: ${field}`);
			}
			next[field] = normalized;
		}
		state = next;
		persist();
		notify();
		return get();
	};

	const reset = () => {
		state = clone(DEFAULT_BRUSH_STATE);
		persist();
		notify();
		return get();
	};

	const subscribe = (listener) => {
		if (typeof listener !== 'function') throw new TypeError('Brush state subscriber must be a function');
		listeners.add(listener);
		return () => listeners.delete(listener);
	};

	return Object.freeze({ get, set, reset, subscribe });
};
