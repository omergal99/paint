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

export const createBrushStrokeRenderer = (context, brush, {
	color = '#000000',
	alpha = 1,
} = {}) => {
	const size = Math.max(1, Number(brush?.size) || 1);
	const spacing = Math.max(1, size * (Number(brush?.spacing) || 0.2));
	const tipShape = brush?.tipShape || 'round';
	const configuredHardness = Math.max(0, Math.min(1, Number(brush?.hardness ?? 1)));
	const hardness = tipShape === 'soft' ? Math.min(configuredHardness, 0.2) : configuredHardness;
	const flow = Math.max(0, Math.min(1, Number(brush?.flow ?? 1)));
	let previous = null;
	let distanceRemainder = 0;

	const stamp = (point, stampAlpha = alpha, sizeMultiplier = 1) => {
		const stampSize = Math.max(1, size * sizeMultiplier);
		const radius = stampSize / 2;
		context.save();
		context.globalAlpha = Math.max(0, Math.min(1, stampAlpha * flow));
		context.fillStyle = color;
		if (tipShape === 'square') {
			context.fillRect(point.x - radius, point.y - radius, stampSize, stampSize);
		} else if (tipShape === 'diamond') {
			context.beginPath();
			context.moveTo(point.x, point.y - radius);
			context.lineTo(point.x + radius, point.y);
			context.lineTo(point.x, point.y + radius);
			context.lineTo(point.x - radius, point.y);
			context.closePath();
			context.fill();
		} else {
			context.beginPath();
			if (hardness < 1 && typeof context.createRadialGradient === 'function') {
				const gradient = context.createRadialGradient(point.x, point.y, radius * hardness, point.x, point.y, radius);
				gradient.addColorStop(0, color);
				gradient.addColorStop(Math.max(0.001, hardness), color);
				gradient.addColorStop(1, transparentColor(color));
				context.fillStyle = gradient;
			}
			context.arc(point.x, point.y, radius, 0, Math.PI * 2);
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
