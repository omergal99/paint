const adjustment = (labelKey, kind, min, max, value, filter = null) => Object.freeze({
	labelKey,
	kind,
	min,
	max,
	defaultValue: value,
	filter,
});

export const ADJUSTMENTS = Object.freeze({
	invert: adjustment('ui.adjustmentInvert', 'filter', 0, 100, 100, (value) => `invert(${value}%)`),
	brightness: adjustment('ui.adjustmentBrightness', 'filter', 0, 200, 100, (value) => `brightness(${value}%)`),
	contrast: adjustment('ui.adjustmentContrast', 'filter', 0, 200, 100, (value) => `contrast(${value}%)`),
	hue: adjustment('ui.adjustmentHue', 'filter', -180, 180, 0, (value) => `hue-rotate(${value}deg)`),
	saturation: adjustment('ui.adjustmentSaturation', 'filter', 0, 300, 100, (value) => `saturate(${value}%)`),
	blur: adjustment('ui.adjustmentBlur', 'filter', 0, 40, 0, (value) => `blur(${value}px)`),
	warmCold: adjustment('ui.adjustmentWarmCold', 'pixels', -100, 100, 0),
	pixelize: adjustment('ui.adjustmentPixelize', 'pixels', 1, 64, 8),
	noise: adjustment('ui.adjustmentNoise', 'pixels', 0, 100, 20),
	pattern: adjustment('ui.adjustmentPattern', 'pattern', 0, 0, 0),
});

export const ADJUSTMENT_PRESETS = Object.freeze({
	warm: Object.freeze({ warmCold: 60 }),
	blackAndWhite: Object.freeze({ saturation: 0 }),
	softBlur: Object.freeze({ blur: 2 }),
});

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

const getValue = (id, params) => {
	const metadata = ADJUSTMENTS[id];
	const raw = Number(params?.value ?? metadata.defaultValue);
	if (!Number.isFinite(raw)) throw new TypeError(`Adjustment "${id}" requires a finite value`);
	return Math.max(metadata.min, Math.min(metadata.max, raw));
};

const createCanvas = (source, documentRef) => {
	if (!source || !Number.isFinite(source.width) || !Number.isFinite(source.height)) {
		throw new TypeError('Adjustment source must be a canvas-like object with dimensions');
	}
	if (!documentRef?.createElement) throw new Error('Adjustment rendering requires a document canvas');
	const canvas = documentRef.createElement('canvas');
	canvas.width = source.width;
	canvas.height = source.height;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context) throw new Error('Adjustment output canvas has no 2D context');
	context.drawImage(source, 0, 0);
	return { canvas, context };
};

const createRandom = (seed) => {
	let state = Number(seed) >>> 0;
	return () => {
		state += 0x6D2B79F5;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
	};
};

const applyWarmCold = (imageData, value) => {
	const shift = value * 0.6;
	for (let index = 0; index < imageData.data.length; index += 4) {
		if (!imageData.data[index + 3]) continue;
		imageData.data[index] = clampByte(imageData.data[index] + shift);
		imageData.data[index + 2] = clampByte(imageData.data[index + 2] - shift);
	}
};

const applyPixelize = (imageData, width, height, blockSize) => {
	const { data } = imageData;
	for (let top = 0; top < height; top += blockSize) {
		for (let left = 0; left < width; left += blockSize) {
			const right = Math.min(width, left + blockSize);
			const bottom = Math.min(height, top + blockSize);
			let alpha = 0;
			let red = 0;
			let green = 0;
			let blue = 0;
			let pixels = 0;
			for (let y = top; y < bottom; y += 1) {
				for (let x = left; x < right; x += 1) {
					const offset = (y * width + x) * 4;
					const opacity = data[offset + 3] / 255;
					alpha += data[offset + 3];
					red += data[offset] * opacity;
					green += data[offset + 1] * opacity;
					blue += data[offset + 2] * opacity;
					pixels += 1;
				}
			}
			const averageAlpha = clampByte(alpha / pixels);
			const averageRed = alpha ? clampByte(red / (alpha / 255)) : 0;
			const averageGreen = alpha ? clampByte(green / (alpha / 255)) : 0;
			const averageBlue = alpha ? clampByte(blue / (alpha / 255)) : 0;
			for (let y = top; y < bottom; y += 1) {
				for (let x = left; x < right; x += 1) {
					const offset = (y * width + x) * 4;
					data[offset] = averageRed;
					data[offset + 1] = averageGreen;
					data[offset + 2] = averageBlue;
					data[offset + 3] = averageAlpha;
				}
			}
		}
	}
};

const applyNoise = (imageData, amount, seed) => {
	const random = createRandom(seed);
	for (let index = 0; index < imageData.data.length; index += 4) {
		if (!imageData.data[index + 3]) continue;
		for (let channel = 0; channel < 3; channel += 1) {
			imageData.data[index + channel] = clampByte(
				imageData.data[index + channel] + (random() * 2 - 1) * amount,
			);
		}
	}
};

const applyPattern = (source, canvas, context) => {
	const pattern = context.createPattern(source, 'repeat');
	if (!pattern) throw new Error('Unable to create a repeating image pattern');
	context.fillStyle = pattern;
	context.fillRect(0, 0, canvas.width, canvas.height);
};

export const applyAdjustment = (source, id, params = {}, { documentRef = globalThis.document } = {}) => {
	const metadata = ADJUSTMENTS[id];
	if (!metadata) throw new RangeError(`Unknown adjustment: ${id}`);
	const value = metadata.kind === 'pattern' ? metadata.defaultValue : getValue(id, params);
	const { canvas, context } = createCanvas(source, documentRef);
	if (metadata.kind === 'filter') {
		context.filter = metadata.filter(value);
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.drawImage(source, 0, 0);
		return canvas;
	}
	if (metadata.kind === 'pattern') {
		context.clearRect(0, 0, canvas.width, canvas.height);
		applyPattern(source, canvas, context);
		return canvas;
	}
	const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
	if (id === 'warmCold') applyWarmCold(imageData, value);
	else if (id === 'pixelize') applyPixelize(imageData, canvas.width, canvas.height, Math.max(1, Math.round(value)));
	else if (id === 'noise') applyNoise(imageData, value, params?.seed ?? 1);
	context.putImageData(imageData, 0, 0);
	return canvas;
};
