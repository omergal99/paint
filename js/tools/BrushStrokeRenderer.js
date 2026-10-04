import { BRUSH_BLEND_COMPOSITE, BRUSH_TIP_OPTIONS } from './BrushState.js';

const parseHexColor = (value) => {
	const hex = String(value || '').trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
	if (!hex) return null;
	const expanded = hex.length === 3 ? [...hex].map((digit) => `${digit}${digit}`).join('') : hex;
	const number = Number.parseInt(expanded, 16);
	return [(number >> 16) & 255, (number >> 8) & 255, number & 255];
};

const transparentColor = (color) => {
	const channels = parseHexColor(color);
	return channels ? `rgba(${channels.join(',')},0)` : 'rgba(0,0,0,0)';
};

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

// Deterministic per-coordinate noise in [0,1). A texture mask must not depend on
// frame timing, so the grain is a pure hash of the stamp position and is
// reproducible in tests. The phase constant keeps the stroke origin from
// collapsing to a full-alpha stamp.
export const textureNoise = (x, y) => {
	const value = Math.sin(x * 12.9898 + y * 78.233 + 1) * 43758.5453;
	return value - Math.floor(value);
};

export const createBrushStrokeRenderer = (context, brush, {
	color = '#000000',
	alpha = 1,
	random = Math.random,
} = {}) => {
	const size = Math.max(1, Number(brush?.size) || 1);
	const spacing = Math.max(1, size * (Number(brush?.spacing) || 0.2));
	const tipShape = brush?.tipShape || 'round';
	const configuredHardness = Math.max(0, Math.min(1, Number(brush?.hardness ?? 1)));
	const softHardness = Math.min(configuredHardness, 0.2);
	const flow = Math.max(0, Math.min(1, Number(brush?.flow ?? 1)));
	const roundness = Math.max(0.05, Math.min(1, Number(brush?.roundness ?? 1)));
	const angle = Number.isFinite(Number(brush?.angle)) ? Number(brush.angle) : 0;
	const angleJitter = clamp01(brush?.angleJitter);
	const scatter = clamp01(brush?.scatter);
	const texture = clamp01(brush?.texture);
	const blendMode = BRUSH_BLEND_COMPOSITE[brush?.blendMode] || 'source-over';
	// Stamp colour sets (random/series) and per-stamp tip shapes only engage
	// when configured, so a plain brush keeps its deterministic PRNG sequence
	// and hot path untouched.
	const colorMode = brush?.colorMode || 'single';
	const stampColors = Array.isArray(brush?.colors)
		? brush.colors.filter((hex) => typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex))
		: [];
	const useStampColors = (colorMode === 'random' || colorMode === 'series') && stampColors.length > 1;
	const randomShape = brush?.randomShape === true;
	let seriesIndex = 0;
	const supportsEllipse = typeof context.ellipse === 'function';
	let previous = null;
	let distanceRemainder = 0;

	// Rotation jitter only advances the PRNG when it is active so a plain brush
	// stays fully deterministic and the hot path never pays for unused math.
	const resolveRotation = () => {
		const jitter = angleJitter ? (random() * 2 - 1) * angleJitter * 180 : 0;
		return ((angle + jitter) * Math.PI) / 180;
	};

	const resolveOffset = (radius) => {
		if (!scatter) return { x: 0, y: 0 };
		const reach = scatter * radius;
		return { x: (random() * 2 - 1) * reach, y: (random() * 2 - 1) * reach };
	};

	const resolveColor = () => {
		if (!useStampColors) return color;
		if (colorMode === 'series') {
			const hex = stampColors[seriesIndex % stampColors.length];
			seriesIndex += 1;
			return hex;
		}
		return stampColors[Math.floor(random() * stampColors.length) % stampColors.length];
	};

	const resolveShape = () => (randomShape
		? BRUSH_TIP_OPTIONS[Math.floor(random() * BRUSH_TIP_OPTIONS.length) % BRUSH_TIP_OPTIONS.length]
		: tipShape);

	const stamp = (point, stampAlpha = alpha, sizeMultiplier = 1) => {
		const stampSize = Math.max(1, size * sizeMultiplier);
		const radius = stampSize / 2;
		const shape = resolveShape();
		const stampColor = resolveColor();
		const stampHardness = shape === 'soft' ? softHardness : configuredHardness;
		const rotation = resolveRotation();
		const offset = resolveOffset(radius);
		const x = point.x + offset.x;
		const y = point.y + offset.y;
		let stampFill = clamp01(stampAlpha * flow);
		if (texture > 0) stampFill *= 1 - texture * textureNoise(x, y);
		context.save();
		context.globalAlpha = clamp01(stampFill);
		if (blendMode !== 'source-over') context.globalCompositeOperation = blendMode;
		context.fillStyle = stampColor;
		if (shape === 'square') {
			if (rotation) {
				context.translate(x, y);
				context.rotate(rotation);
				context.fillRect(-radius, -radius, stampSize, stampSize);
			} else {
				context.fillRect(x - radius, y - radius, stampSize, stampSize);
			}
		} else if (shape === 'diamond') {
			// Half-diagonal r*sqrt(2): exactly the size x size square rotated 45
			// degrees, so the diamond matches the square tip's footprint and the
			// pointer overlay's `rotate(45deg)` box stays pixel-accurate.
			const reach = radius * Math.SQRT2;
			if (rotation) {
				context.translate(x, y);
				context.rotate(rotation);
				context.beginPath();
				context.moveTo(0, -reach);
				context.lineTo(reach, 0);
				context.lineTo(0, reach);
				context.lineTo(-reach, 0);
			} else {
				context.beginPath();
				context.moveTo(x, y - reach);
				context.lineTo(x + reach, y);
				context.lineTo(x, y + reach);
				context.lineTo(x - reach, y);
			}
			context.closePath();
			context.fill();
		} else {
			const elliptical = (roundness < 1 || rotation) && supportsEllipse;
			context.beginPath();
			if (elliptical) {
				context.ellipse(x, y, radius * roundness, radius, rotation, 0, Math.PI * 2);
			} else {
				if (stampHardness < 1 && typeof context.createRadialGradient === 'function') {
					const gradient = context.createRadialGradient(x, y, radius * stampHardness, x, y, radius);
					gradient.addColorStop(0, stampColor);
					gradient.addColorStop(Math.max(0.001, stampHardness), stampColor);
					gradient.addColorStop(1, transparentColor(stampColor));
					context.fillStyle = gradient;
				}
				context.arc(x, y, radius, 0, Math.PI * 2);
			}
			context.fill();
		}
		context.restore();
	};

	const drawTo = (point, stampAlpha = alpha, sizeMultiplier = 1) => {
		if (!previous) {
			stamp(point, stampAlpha, sizeMultiplier);
			previous = { x: point.x, y: point.y };
			return;
		}
		const dx = point.x - previous.x;
		const dy = point.y - previous.y;
		const length = Math.hypot(dx, dy);
		if (!length) return;
		let travelled = spacing - distanceRemainder;
		while (travelled <= length) {
			const ratio = travelled / length;
			stamp({ x: previous.x + dx * ratio, y: previous.y + dy * ratio }, stampAlpha, sizeMultiplier);
			travelled += spacing;
		}
		distanceRemainder = (distanceRemainder + length) % spacing;
		previous = { x: point.x, y: point.y };
	};

	return Object.freeze({ drawTo });
};
