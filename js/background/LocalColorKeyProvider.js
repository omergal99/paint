// Local, browser-only color-key fallback. It never calls fetch, opens a Worker,
// or sends image bytes anywhere; it is the safe default while advanced removal
// remains an optional provider.

import {
	BACKGROUND_REMOVAL_ERROR_CODES,
	BACKGROUND_REMOVAL_PROVIDER_IDS,
	admitBackgroundRemovalBlob,
	admitBackgroundRemovalInput,
	createAbortFailure,
	createBackgroundRemovalError,
	createBackgroundRemovalFailure,
	createBackgroundRemovalSuccess,
	isAbortSignalAborted,
	normalizeBackgroundRemovalLimits,
} from './BackgroundRemovalProvider.js';

const defaultCreateCanvas = (width, height) => {
	if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
	if (typeof document === 'undefined') throw new Error('Canvas is unavailable in this environment.');
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return canvas;
};

const defaultYieldToMain = () => new Promise((resolve) => setTimeout(resolve, 0));
const defaultCreateImageBitmap = (...args) => {
	if (typeof globalThis.createImageBitmap !== 'function') throw new Error('Image decoding is unavailable in this browser.');
	return globalThis.createImageBitmap(...args);
};

const notify = (listener, update) => {
	try { listener?.(Object.freeze(update)); } catch {}
};

const normalizeTolerance = (value) => {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return 30;
	return Math.max(0, Math.min(255, Math.round(numeric)));
};

const normalizeMode = (value) => ['flood-fill', 'soft-edge'].includes(value) ? value : 'color-key';

const clampColorChannel = (value) => Math.max(0, Math.min(255, Math.round(Number(value) || 0)));

const normalizeBackgroundColor = (value, fallback) => {
	if (Array.isArray(value) && value.length >= 3) {
		return [clampColorChannel(value[0]), clampColorChannel(value[1]), clampColorChannel(value[2])];
	}
	if (value && typeof value === 'object' && Number.isFinite(value.r) && Number.isFinite(value.g) && Number.isFinite(value.b)) {
		return [clampColorChannel(value.r), clampColorChannel(value.g), clampColorChannel(value.b)];
	}
	if (typeof value === 'string') {
		const hex = value.trim().replace(/^#/, '');
		if (/^[\da-f]{3}$/i.test(hex)) {
			return [...hex].map((channel) => Number.parseInt(`${channel}${channel}`, 16));
		}
		if (/^[\da-f]{6}$/i.test(hex)) {
			return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
		}
	}
	return fallback;
};

const colorDifference = (data, index, background) => Math.abs(data[index] - background[0])
	+ Math.abs(data[index + 1] - background[1])
	+ Math.abs(data[index + 2] - background[2]);

const matchesBackground = (data, index, background, threshold) => (
	data[index + 3] === 0 || colorDifference(data, index, background) <= threshold
);

const normalizeRegions = (value, width, height) => (Array.isArray(value) ? value : [])
	.map((region) => {
		const x = Math.max(0, Math.min(1, Number(region?.x) || 0));
		const y = Math.max(0, Math.min(1, Number(region?.y) || 0));
		const w = Math.max(0, Math.min(1 - x, Number(region?.w) || 0));
		const h = Math.max(0, Math.min(1 - y, Number(region?.h) || 0));
		return { x: Math.floor(x * width), y: Math.floor(y * height), w: Math.max(1, Math.ceil(w * width)), h: Math.max(1, Math.ceil(h * height)) };
	})
	.filter((region) => region.w > 0 && region.h > 0);

const applyRegions = (data, originalAlpha, regions, width, height, mode) => {
	for (const region of regions) {
		const maxY = Math.min(height, region.y + region.h);
		const maxX = Math.min(width, region.x + region.w);
		for (let y = region.y; y < maxY; y += 1) {
			for (let x = region.x; x < maxX; x += 1) {
				const index = (y * width + x) * 4;
				data[index + 3] = mode === 'keep' ? originalAlpha[y * width + x] : 0;
			}
		}
	}
};

const encodePng = async (canvas) => {
	if (typeof canvas.convertToBlob === 'function') return canvas.convertToBlob({ type: 'image/png' });
	if (typeof canvas.toBlob !== 'function') throw new Error('PNG encoding is unavailable in this browser.');
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error('PNG encoding returned no data.'));
		}, 'image/png');
	});
};

const abortResult = (providerId) => createAbortFailure(providerId);

const processingFailure = (providerId, error, code = BACKGROUND_REMOVAL_ERROR_CODES.processingFailed) => createBackgroundRemovalFailure({
	providerId,
	error: createBackgroundRemovalError({
		code,
		message: 'Local background removal could not finish.',
		cause: error?.message || error,
	}),
});

const decodeImage = async ({ imageBlob, signal, createImageBitmapFn }) => {
	if (isAbortSignalAborted(signal)) throw Object.assign(new Error('Operation aborted.'), { name: 'AbortError' });
	const bitmap = await createImageBitmapFn(imageBlob);
	if (isAbortSignalAborted(signal)) {
		bitmap?.close?.();
		throw Object.assign(new Error('Operation aborted.'), { name: 'AbortError' });
	}
	return bitmap;
};

/**
 * The provider contract is:
 * - inspectInput(imageBlob, signal) -> { width, height }
 * - remove(imageBlob, options, signal, onProgress) -> BackgroundRemovalResult
 *
 * `remove` repeats decoded-size admission so callers can use this provider
 * directly without accidentally bypassing the service boundary.
 */
export const createLocalColorKeyProvider = ({
	createImageBitmapFn = defaultCreateImageBitmap,
	createCanvas = defaultCreateCanvas,
	yieldToMain = defaultYieldToMain,
	limits,
	chunkPixels = 1_048_576,
} = {}) => {
	const boundedLimits = normalizeBackgroundRemovalLimits(limits);
	const providerId = BACKGROUND_REMOVAL_PROVIDER_IDS.local;

	const inspectInput = async (imageBlob, signal) => {
		let bitmap = null;
		try {
			bitmap = await decodeImage({ imageBlob, signal, createImageBitmapFn });
			return { width: bitmap.width, height: bitmap.height };
		} finally {
			bitmap?.close?.();
		}
	};

	const remove = async (imageBlob, options = {}, signal = null, onProgress = null) => {
		if (isAbortSignalAborted(signal)) return abortResult(providerId);
		const blobAdmission = admitBackgroundRemovalBlob({ imageBlob, limits: options.limits || boundedLimits });
		if (!blobAdmission.ok) return createBackgroundRemovalFailure({ providerId, error: blobAdmission.error });
		let bitmap = null;
		let phase = 'decode';
		try {
			notify(onProgress, { phase: 'decode', completed: 0, total: 1 });
			bitmap = await decodeImage({ imageBlob, signal, createImageBitmapFn });
			const admission = admitBackgroundRemovalInput({
				imageBlob,
				width: bitmap.width,
				height: bitmap.height,
				limits: options.limits || boundedLimits,
				workingBytesPerPixel: options.mode === 'flood-fill' ? 17 : 13,
			});
			if (!admission.ok) return createBackgroundRemovalFailure({ providerId, error: admission.error });
			if (isAbortSignalAborted(signal)) return abortResult(providerId);

			phase = 'process';
			const canvas = createCanvas(admission.width, admission.height);
			const context = canvas?.getContext?.('2d', { willReadFrequently: true });
			if (!context) throw new Error('2D canvas context is unavailable.');
			context.drawImage(bitmap, 0, 0);
			const imageData = context.getImageData(0, 0, admission.width, admission.height);
			const data = imageData.data;
			const originalAlpha = new Uint8Array(admission.pixels);
			for (let pixel = 0; pixel < admission.pixels; pixel += 1) originalAlpha[pixel] = data[pixel * 4 + 3];
			const mode = normalizeMode(options.mode);
			const tolerance = normalizeTolerance(options.tolerance);
			const threshold = tolerance * 3;
			const edgeSoftness = Math.max(1, normalizeTolerance(options.edgeSoftness ?? 25)) * 3;
			const background = normalizeBackgroundColor(options.backgroundColor, [data[0], data[1], data[2]]);
			const pixelsPerYield = Math.max(1, Math.floor(chunkPixels));
			notify(onProgress, { phase: 'remove', completed: 0, total: admission.pixels });
			if (mode === 'flood-fill') {
				// Flood-fill removes only background-connected pixels from the image
				// edges. The typed queue and visited map keep memory bounded and avoid
				// recursive call-stack growth on large images.
				const visited = new Uint8Array(admission.pixels);
				const queue = new Uint32Array(admission.pixels);
				let queueStart = 0;
				let queueEnd = 0;
				const width = admission.width;
				const height = admission.height;
				const enqueue = (pixel) => {
					if (visited[pixel]) return;
					visited[pixel] = 1;
					const index = pixel * 4;
					if (!matchesBackground(data, index, background, threshold)) return;
					queue[queueEnd] = pixel;
					queueEnd += 1;
					data[index + 3] = 0;
				};
				for (let x = 0; x < width; x += 1) {
					enqueue(x);
					enqueue((height - 1) * width + x);
				}
				for (let y = 1; y < height - 1; y += 1) {
					enqueue(y * width);
					enqueue(y * width + width - 1);
				}
				let processed = 0;
				while (queueStart < queueEnd) {
					if (processed % pixelsPerYield === 0) {
						if (isAbortSignalAborted(signal)) return abortResult(providerId);
						if (processed > 0) {
							notify(onProgress, { phase: 'remove', completed: processed, total: admission.pixels });
							await yieldToMain();
							if (isAbortSignalAborted(signal)) return abortResult(providerId);
						}
					}
					const pixel = queue[queueStart];
					queueStart += 1;
					processed += 1;
					const x = pixel % width;
					const y = Math.floor(pixel / width);
					if (x > 0) enqueue(pixel - 1);
					if (x + 1 < width) enqueue(pixel + 1);
					if (y > 0) enqueue(pixel - width);
					if (y + 1 < height) enqueue(pixel + width);
				}
			} else {
				for (let pixel = 0; pixel < admission.pixels; pixel += 1) {
					if (pixel % pixelsPerYield === 0) {
						if (isAbortSignalAborted(signal)) return abortResult(providerId);
						if (pixel > 0) {
							notify(onProgress, { phase: 'remove', completed: pixel, total: admission.pixels });
							await yieldToMain();
							if (isAbortSignalAborted(signal)) return abortResult(providerId);
						}
					}
					const index = pixel * 4;
					if (data[index + 3] === 0) continue;
					const difference = colorDifference(data, index, background);
					if (mode === 'soft-edge') {
						if (difference <= threshold) data[index + 3] = 0;
						else if (difference < threshold + edgeSoftness) {
							const ratio = (difference - threshold) / edgeSoftness;
							data[index + 3] = Math.round(originalAlpha[pixel] * ratio);
						}
					} else if (difference <= threshold) data[index + 3] = 0;
				}
			}
			applyRegions(data, originalAlpha, normalizeRegions(options.keepRegions, admission.width, admission.height), admission.width, admission.height, 'keep');
			applyRegions(data, originalAlpha, normalizeRegions(options.removeRegions, admission.width, admission.height), admission.width, admission.height, 'remove');
			context.putImageData(imageData, 0, 0);
			notify(onProgress, { phase: 'encode', completed: 1, total: 1 });
			if (isAbortSignalAborted(signal)) return abortResult(providerId);
			phase = 'encode';
			const output = await encodePng(canvas);
			if (isAbortSignalAborted(signal)) return abortResult(providerId);
			notify(onProgress, { phase: 'complete', completed: 1, total: 1 });
			return createBackgroundRemovalSuccess({
				providerId,
				imageBlob: output,
				width: admission.width,
				height: admission.height,
				privacy: Object.freeze({ uploadsImage: false, description: 'Processed locally in this browser.' }),
			});
		} catch (error) {
			if (isAbortSignalAborted(signal) || error?.name === 'AbortError') return abortResult(providerId);
			const code = phase === 'decode'
				? BACKGROUND_REMOVAL_ERROR_CODES.decodeFailed
				: (phase === 'encode' ? BACKGROUND_REMOVAL_ERROR_CODES.encodeFailed : BACKGROUND_REMOVAL_ERROR_CODES.processingFailed);
			return processingFailure(providerId, error, code);
		} finally {
			bitmap?.close?.();
		}
	};

	return Object.freeze({
		id: providerId,
		label: 'Local color-key removal',
		privacy: Object.freeze({ uploadsImage: false, description: 'Processed locally in this browser.' }),
		inspectInput,
		remove,
	});
};
