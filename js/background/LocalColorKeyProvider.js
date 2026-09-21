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
			const tolerance = normalizeTolerance(options.tolerance);
			const background = [data[0], data[1], data[2]];
			const pixelsPerYield = Math.max(1, Math.floor(chunkPixels));
			notify(onProgress, { phase: 'remove', completed: 0, total: admission.pixels });
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
				const difference = Math.abs(data[index] - background[0])
					+ Math.abs(data[index + 1] - background[1])
					+ Math.abs(data[index + 2] - background[2]);
				if (difference <= tolerance * 3) data[index + 3] = 0;
			}
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
