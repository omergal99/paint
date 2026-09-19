import { hexToRgb, rgbToHex } from './color.js';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function normalizeRgba(value, fallback = { r: 0, g: 0, b: 0, a: 1 }) {
	const source = typeof value === 'string' ? hexToRgb(value) : value;
	const r = Number(source?.r);
	const g = Number(source?.g);
	const b = Number(source?.b);
	const a = Number(source?.a ?? 1);
	if (![r, g, b, a].every(Number.isFinite)) return { ...fallback };
	return {
		r: Math.max(0, Math.min(255, Math.round(r))),
		g: Math.max(0, Math.min(255, Math.round(g))),
		b: Math.max(0, Math.min(255, Math.round(b))),
		a: Math.max(0, Math.min(1, a)),
	};
}

export function rgbaToCss(value, fallback) {
	const rgba = normalizeRgba(value, fallback);
	return `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${Number(rgba.a.toFixed(3))})`;
}

export function rgbaToHex(value, fallback = { r: 0, g: 0, b: 0, a: 1 }) {
	const rgba = normalizeRgba(value, fallback);
	return rgbToHex(rgba.r, rgba.g, rgba.b);
}

export function isHexColor(value) {
	return typeof value === 'string' && HEX_COLOR.test(value);
}

export function colorStateToCss({ hex = '#000000', alpha = 1 } = {}) {
	const rgb = hexToRgb(isHexColor(hex) ? hex : '#000000');
	return rgbaToCss({ ...rgb, a: alpha });
}
