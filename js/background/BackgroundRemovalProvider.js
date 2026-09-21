// Bounded, provider-neutral background-removal contract. The base editor can
// use the local provider without loading a model, worker, or network client.

import { LIMITS } from '../core/constants.js';
import { assessImageAdmission } from '../storage/ImageAdmission.js';

export const BACKGROUND_REMOVAL_PROVIDER_IDS = Object.freeze({
	local: 'local-color-key',
	advanced: 'advanced',
});

export const BACKGROUND_REMOVAL_ERROR_CODES = Object.freeze({
	aborted: 'aborted',
	timeout: 'timeout',
	invalidInput: 'invalid-input',
	unsupportedInput: 'unsupported-input',
	inputTooLarge: 'input-too-large',
	inputPixelLimit: 'input-pixel-limit',
	workingMemoryLimit: 'working-memory-limit',
	advancedOptInRequired: 'advanced-opt-in-required',
	advancedUnavailable: 'advanced-unavailable',
	uploadConsentRequired: 'upload-consent-required',
	providerContractInvalid: 'provider-contract-invalid',
	decodeFailed: 'decode-failed',
	processingFailed: 'processing-failed',
	encodeFailed: 'encode-failed',
});

// A removal operation commonly owns a decoded source, output canvas, and
// ImageData at the same time. The 16M-pixel cap keeps that temporary working
// set bounded independently from the broader import limit.
export const DEFAULT_BACKGROUND_REMOVAL_LIMITS = Object.freeze({
	maxInputBytes: 20 * 1024 * 1024,
	maxInputPixels: Math.min(LIMITS.maxImportPixels, 16 * 1024 * 1024),
	maxWorkingBytes: 192 * 1024 * 1024,
	maxWallTimeMs: 15_000,
});

const isPositiveSafeInteger = (value) => Number.isSafeInteger(value) && value > 0;
const isBlobLike = (value) => value && Number.isFinite(value.size) && value.size >= 0;
const elapsed = (startedAt, now) => Math.max(0, Math.round(now() - startedAt));
const errorMessage = (error) => String(error?.message || error || '').trim();

const finiteLimit = (value, fallback) => (
	Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
);

export const normalizeBackgroundRemovalLimits = (limits = {}) => Object.freeze({
	maxInputBytes: finiteLimit(limits.maxInputBytes, DEFAULT_BACKGROUND_REMOVAL_LIMITS.maxInputBytes),
	maxInputPixels: finiteLimit(limits.maxInputPixels, DEFAULT_BACKGROUND_REMOVAL_LIMITS.maxInputPixels),
	maxWorkingBytes: finiteLimit(limits.maxWorkingBytes, DEFAULT_BACKGROUND_REMOVAL_LIMITS.maxWorkingBytes),
	maxWallTimeMs: finiteLimit(limits.maxWallTimeMs, DEFAULT_BACKGROUND_REMOVAL_LIMITS.maxWallTimeMs),
});

export const createBackgroundRemovalError = ({
	code = BACKGROUND_REMOVAL_ERROR_CODES.processingFailed,
	message = 'Background removal could not finish.',
	retryable = false,
	cause = '',
} = {}) => Object.freeze({
	code,
	message,
	retryable: Boolean(retryable),
	cause: cause ? String(cause) : '',
});

export const createBackgroundRemovalFailure = ({
	providerId = null,
	error,
	elapsedMs = 0,
} = {}) => Object.freeze({
	ok: false,
	providerId: providerId || null,
	error: error || createBackgroundRemovalError(),
	elapsedMs: Math.max(0, Math.round(elapsedMs) || 0),
});

export const createBackgroundRemovalSuccess = ({
	providerId,
	imageBlob,
	width,
	height,
	elapsedMs = 0,
	privacy = null,
} = {}) => Object.freeze({
	ok: true,
	providerId: providerId || null,
	imageBlob,
	width: isPositiveSafeInteger(width) ? width : null,
	height: isPositiveSafeInteger(height) ? height : null,
	elapsedMs: Math.max(0, Math.round(elapsedMs) || 0),
	privacy: privacy || null,
});

export const isAbortSignalAborted = (signal) => Boolean(signal?.aborted);

export const createAbortFailure = (providerId = null, elapsedMs = 0) => createBackgroundRemovalFailure({
	providerId,
	elapsedMs,
	error: createBackgroundRemovalError({
		code: BACKGROUND_REMOVAL_ERROR_CODES.aborted,
		message: 'Background removal was cancelled.',
		retryable: true,
	}),
});

const createInputFailure = (code, message) => createBackgroundRemovalError({ code, message, retryable: false });

// This first gate is intentionally independent from image decoding. It lets a
// caller reject an oversized file before an optional provider/model is loaded.
export const admitBackgroundRemovalBlob = ({ imageBlob, limits } = {}) => {
	const boundedLimits = normalizeBackgroundRemovalLimits(limits);
	if (!isBlobLike(imageBlob)) {
		return { ok: false, error: createInputFailure(BACKGROUND_REMOVAL_ERROR_CODES.invalidInput, 'Choose a valid image file first.') };
	}
	if (imageBlob.type && !String(imageBlob.type).toLowerCase().startsWith('image/')) {
		return { ok: false, error: createInputFailure(BACKGROUND_REMOVAL_ERROR_CODES.unsupportedInput, 'Background removal needs an image file.') };
	}
	if (imageBlob.size > boundedLimits.maxInputBytes) {
		return {
			ok: false,
			error: createInputFailure(
				BACKGROUND_REMOVAL_ERROR_CODES.inputTooLarge,
				`Image is larger than the ${boundedLimits.maxInputBytes}-byte background-removal limit.`,
			),
		};
	}
	return { ok: true, limits: boundedLimits };
};

/**
 * Validates an encoded input before decoding it, then validates decoded
 * dimensions before allocating working canvases. Providers must call this as
 * a defence in depth measure; the service calls it before provider.remove().
 */
export const admitBackgroundRemovalInput = ({ imageBlob, width, height, limits, workingBytesPerPixel = 12 } = {}) => {
	const blobAdmission = admitBackgroundRemovalBlob({ imageBlob, limits });
	if (!blobAdmission.ok) return blobAdmission;
	const boundedLimits = blobAdmission.limits;
	if (!isPositiveSafeInteger(width) || !isPositiveSafeInteger(height)) {
		return { ok: false, error: createInputFailure(BACKGROUND_REMOVAL_ERROR_CODES.invalidInput, 'Image dimensions must be positive whole pixels.') };
	}
	const imageAdmission = assessImageAdmission({ width, height });
	if (!imageAdmission.ok) {
		return { ok: false, error: createInputFailure(BACKGROUND_REMOVAL_ERROR_CODES.invalidInput, imageAdmission.message) };
	}
	const pixels = width * height;
	if (pixels > boundedLimits.maxInputPixels) {
		return {
			ok: false,
			error: createInputFailure(
				BACKGROUND_REMOVAL_ERROR_CODES.inputPixelLimit,
				`Image exceeds the ${boundedLimits.maxInputPixels}-pixel background-removal limit.`,
			),
		};
	}
	const bytesPerPixel = Number.isFinite(workingBytesPerPixel) && workingBytesPerPixel >= 12
		? Math.floor(workingBytesPerPixel)
		: 12;
	if (pixels * bytesPerPixel > boundedLimits.maxWorkingBytes) {
		return {
			ok: false,
			error: createInputFailure(
				BACKGROUND_REMOVAL_ERROR_CODES.workingMemoryLimit,
				'Image would exceed the temporary memory limit for background removal.',
			),
		};
	}
	return { ok: true, width, height, pixels, limits: boundedLimits };
};

export const isBackgroundRemovalProvider = (provider) => Boolean(
	provider
	&& typeof provider.id === 'string'
	&& typeof provider.inspectInput === 'function'
	&& typeof provider.remove === 'function',
);

const failureFromException = ({ providerId, error, elapsedMs }) => {
	const message = errorMessage(error);
	const aborted = error?.name === 'AbortError' || /abort|cancel/i.test(message);
	return createBackgroundRemovalFailure({
		providerId,
		elapsedMs,
		error: createBackgroundRemovalError({
			code: aborted ? BACKGROUND_REMOVAL_ERROR_CODES.aborted : BACKGROUND_REMOVAL_ERROR_CODES.processingFailed,
			message: aborted ? 'Background removal was cancelled.' : 'Background removal could not finish.',
			retryable: aborted,
			cause: message,
		}),
	});
};

const normalizeProviderResult = ({ result, provider, elapsedMs }) => {
	if (result?.ok === false && result.error) {
		return createBackgroundRemovalFailure({ providerId: provider.id, elapsedMs, error: result.error });
	}
	if (!result?.ok || !isBlobLike(result.imageBlob) || !isPositiveSafeInteger(result.width) || !isPositiveSafeInteger(result.height)) {
		return createBackgroundRemovalFailure({
			providerId: provider.id,
			elapsedMs,
			error: createBackgroundRemovalError({
				code: BACKGROUND_REMOVAL_ERROR_CODES.providerContractInvalid,
				message: 'The selected background-removal provider returned an invalid result.',
			}),
		});
	}
	return createBackgroundRemovalSuccess({
		providerId: provider.id,
		imageBlob: result.imageBlob,
		width: result.width,
		height: result.height,
		elapsedMs,
		privacy: provider.privacy || null,
	});
};

const createRequestControl = ({ signal, timeoutMs, AbortControllerCtor = globalThis.AbortController, setTimeoutFn = globalThis.setTimeout, clearTimeoutFn = globalThis.clearTimeout }) => {
	const controller = typeof AbortControllerCtor === 'function' ? new AbortControllerCtor() : null;
	let settled = false;
	let timer = null;
	let abortListener = null;
	let resolveCancellation = null;
	const cancellation = new Promise((resolve) => { resolveCancellation = resolve; });
	const finishCancellation = (kind) => {
		if (settled) return;
		settled = true;
		try { controller?.abort(); } catch {}
		resolveCancellation?.({ kind });
	};
	if (isAbortSignalAborted(signal)) finishCancellation('aborted');
	else if (signal?.addEventListener) {
		abortListener = () => finishCancellation('aborted');
		signal.addEventListener('abort', abortListener, { once: true });
	}
	if (!settled && typeof setTimeoutFn === 'function') {
		timer = setTimeoutFn(() => finishCancellation('timeout'), timeoutMs);
	}

	const run = (operation) => {
		const task = Promise.resolve()
			.then(operation)
			.then((value) => ({ kind: 'value', value }), (error) => ({ kind: 'error', error }));
		return Promise.race([task, cancellation]);
	};
	const cleanup = () => {
		if (timer != null && typeof clearTimeoutFn === 'function') clearTimeoutFn(timer);
		if (abortListener && signal?.removeEventListener) signal.removeEventListener('abort', abortListener);
	};
	return { signal: controller?.signal || signal, run, cleanup };
};

const timeoutFailure = (providerId, elapsedMs) => createBackgroundRemovalFailure({
	providerId,
	elapsedMs,
	error: createBackgroundRemovalError({
		code: BACKGROUND_REMOVAL_ERROR_CODES.timeout,
		message: 'Background removal took too long and was stopped.',
		retryable: true,
	}),
});

const invalidProviderFailure = (providerId, elapsedMs) => createBackgroundRemovalFailure({
	providerId,
	elapsedMs,
	error: createBackgroundRemovalError({
		code: BACKGROUND_REMOVAL_ERROR_CODES.providerContractInvalid,
		message: 'The selected background-removal provider is not available.',
	}),
});

const getRequestedTimeout = (options, limits) => {
	const requested = Number(options?.timeoutMs);
	if (!Number.isFinite(requested) || requested <= 0) return limits.maxWallTimeMs;
	return Math.min(Math.floor(requested), limits.maxWallTimeMs);
};

/**
 * Coordinates only providers supplied to it. It owns no model, Worker, fetch,
 * or upload path. Advanced loading is delegated and is never attempted until
 * the caller passes both `providerId: 'advanced'` and `advancedOptIn: true`.
 */
export const createBackgroundRemovalService = ({
	localProvider,
	advancedProviderLoader = null,
	limits,
	now = () => Date.now(),
	AbortControllerCtor,
	setTimeoutFn,
	clearTimeoutFn,
} = {}) => {
	const boundedLimits = normalizeBackgroundRemovalLimits(limits);

	const getProvider = async ({ providerId, options, control }) => {
		if (!providerId || providerId === localProvider?.id || providerId === BACKGROUND_REMOVAL_PROVIDER_IDS.local) {
			return { ok: true, provider: localProvider };
		}
		if (providerId !== BACKGROUND_REMOVAL_PROVIDER_IDS.advanced) {
			return {
				ok: false,
				error: createBackgroundRemovalError({
					code: BACKGROUND_REMOVAL_ERROR_CODES.advancedUnavailable,
					message: 'That background-removal provider is unavailable.',
				}),
			};
		}
		if (options?.advancedOptIn !== true) {
			return {
				ok: false,
				error: createBackgroundRemovalError({
					code: BACKGROUND_REMOVAL_ERROR_CODES.advancedOptInRequired,
					message: 'Choose Advanced removal before loading an optional provider.',
					retryable: true,
				}),
			};
		}
		if (!advancedProviderLoader?.load) {
			return {
				ok: false,
				error: createBackgroundRemovalError({
					code: BACKGROUND_REMOVAL_ERROR_CODES.advancedUnavailable,
					message: 'No advanced background-removal provider is installed.',
				}),
			};
		}
		const loaded = await control.run(() => advancedProviderLoader.load({ explicitOptIn: true, signal: control.signal }));
		if (loaded.kind !== 'value') return loaded;
		if (!loaded.value?.ok) return { ok: false, error: loaded.value?.error };
		return { ok: true, provider: loaded.value.provider };
	};

	const remove = async (imageBlob, options = {}, signal = null) => {
		const startedAt = now();
		const requestedProviderId = options.providerId || localProvider?.id || BACKGROUND_REMOVAL_PROVIDER_IDS.local;
		if (isAbortSignalAborted(signal)) return createAbortFailure(requestedProviderId, elapsed(startedAt, now));
		const encodedAdmission = admitBackgroundRemovalBlob({ imageBlob, limits: boundedLimits });
		if (!encodedAdmission.ok) {
			return createBackgroundRemovalFailure({
				providerId: requestedProviderId,
				elapsedMs: elapsed(startedAt, now),
				error: encodedAdmission.error,
			});
		}
		const control = createRequestControl({
			signal,
			timeoutMs: getRequestedTimeout(options, boundedLimits),
			AbortControllerCtor,
			setTimeoutFn,
			clearTimeoutFn,
		});
		let provider = null;
		try {
			const selected = await getProvider({ providerId: requestedProviderId, options, control });
			if (selected?.kind === 'timeout') return timeoutFailure(requestedProviderId, elapsed(startedAt, now));
			if (selected?.kind === 'aborted') return createAbortFailure(requestedProviderId, elapsed(startedAt, now));
			if (!selected.ok) {
				return createBackgroundRemovalFailure({
					providerId: requestedProviderId,
					elapsedMs: elapsed(startedAt, now),
					error: selected.error || createBackgroundRemovalError(),
				});
			}
			provider = selected.provider;
			if (!isBackgroundRemovalProvider(provider)) return invalidProviderFailure(requestedProviderId, elapsed(startedAt, now));
			if (provider.privacy?.uploadsImage === true && options.allowImageUpload !== true) {
				return createBackgroundRemovalFailure({
					providerId: provider.id,
					elapsedMs: elapsed(startedAt, now),
					error: createBackgroundRemovalError({
						code: BACKGROUND_REMOVAL_ERROR_CODES.uploadConsentRequired,
						message: 'This provider may send the image off this device. Explicit upload consent is required.',
						retryable: true,
					}),
				});
			}
			const inspected = await control.run(() => provider.inspectInput(imageBlob, control.signal));
			if (inspected.kind === 'timeout') return timeoutFailure(provider.id, elapsed(startedAt, now));
			if (inspected.kind === 'aborted') return createAbortFailure(provider.id, elapsed(startedAt, now));
			if (inspected.kind === 'error') return failureFromException({ providerId: provider.id, error: inspected.error, elapsedMs: elapsed(startedAt, now) });
			const admission = admitBackgroundRemovalInput({
				imageBlob,
				width: inspected.value?.width,
				height: inspected.value?.height,
				limits: boundedLimits,
				workingBytesPerPixel: options.mode === 'flood-fill' ? 17 : 13,
			});
			if (!admission.ok) return createBackgroundRemovalFailure({ providerId: provider.id, elapsedMs: elapsed(startedAt, now), error: admission.error });
			const removed = await control.run(() => provider.remove(imageBlob, {
				...options,
				limits: boundedLimits,
				input: { width: admission.width, height: admission.height, pixels: admission.pixels },
			}, control.signal, options.onProgress));
			if (removed.kind === 'timeout') return timeoutFailure(provider.id, elapsed(startedAt, now));
			if (removed.kind === 'aborted') return createAbortFailure(provider.id, elapsed(startedAt, now));
			if (removed.kind === 'error') return failureFromException({ providerId: provider.id, error: removed.error, elapsedMs: elapsed(startedAt, now) });
			return normalizeProviderResult({ result: removed.value, provider, elapsedMs: elapsed(startedAt, now) });
		} finally {
			control.cleanup();
		}
	};

	return Object.freeze({
		remove,
		limits: boundedLimits,
		getProviderIds: () => Object.freeze([
			localProvider?.id || BACKGROUND_REMOVAL_PROVIDER_IDS.local,
			...(advancedProviderLoader ? [BACKGROUND_REMOVAL_PROVIDER_IDS.advanced] : []),
		]),
	});
};
