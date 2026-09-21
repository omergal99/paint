// Optional advanced-provider boundary. This file contains no model URL,
// fetch(), Worker creation, or upload implementation. A future UI must supply
// a self-hosted dynamic importer only after the person explicitly chooses the
// advanced path and sees its privacy/runtime disclosure.

import {
	BACKGROUND_REMOVAL_ERROR_CODES,
	createAbortFailure,
	createBackgroundRemovalError,
	isAbortSignalAborted,
	isBackgroundRemovalProvider,
} from './BackgroundRemovalProvider.js';

export const ADVANCED_BACKGROUND_PROVIDER_REQUIREMENTS = Object.freeze({
	requiresExplicitOptIn: true,
	requiresDedicatedWorker: true,
	requiresSelfHostedVersionedAssets: true,
	requiresProgress: true,
	requiresCancellation: true,
	requiresInputAndWallTimeLimits: true,
	requiresUploadConsentForRemoteProcessing: true,
	baseEditorMustRemainOffline: true,
});

const unavailable = (message = 'No advanced background-removal provider is installed.') => ({
	ok: false,
	error: createBackgroundRemovalError({
		code: BACKGROUND_REMOVAL_ERROR_CODES.advancedUnavailable,
		message,
	}),
});

const optInRequired = () => ({
	ok: false,
	error: createBackgroundRemovalError({
		code: BACKGROUND_REMOVAL_ERROR_CODES.advancedOptInRequired,
		message: 'Choose Advanced removal before loading an optional provider.',
		retryable: true,
	}),
});

const isRelativeModulePath = (value) => typeof value === 'string' && (/^(?:\.\/|\.\.\/)/.test(value));

/**
 * Returns an importer suitable for native `import()` only for a relative,
 * self-hosted module path. Calling this factory does not fetch anything; the
 * returned function is invoked by `load()` after explicit user opt-in.
 */
export const createSelfHostedAdvancedProviderImporter = (modulePath) => {
	if (!isRelativeModulePath(modulePath)) return null;
	return () => import(modulePath);
};

const providerFromModule = async (module) => {
	const factory = module?.createAdvancedBackgroundRemovalProvider || module?.default;
	const provider = typeof factory === 'function' ? await factory() : module?.provider;
	return isBackgroundRemovalProvider(provider) ? provider : null;
};

/**
 * `importProvider` is injected by the integration point, for example:
 *
 * createAdvancedProviderLoader({
 *   importProvider: createSelfHostedAdvancedProviderImporter('./advanced/entry.js'),
 * });
 *
 * This boundary deliberately has no default importer, so the base app cannot
 * accidentally download a model or initialize a Python runtime on first load.
 */
export const createAdvancedProviderLoader = ({ importProvider = null } = {}) => {
	let provider = null;
	let loading = null;

	const load = async ({ explicitOptIn = false, signal = null } = {}) => {
		if (isAbortSignalAborted(signal)) return { ok: false, error: createAbortFailure('advanced').error };
		if (explicitOptIn !== true) return optInRequired();
		if (provider) return { ok: true, provider };
		if (typeof importProvider !== 'function') return unavailable();
		if (!loading) {
			loading = Promise.resolve()
				.then(importProvider)
				.then(providerFromModule)
				.finally(() => { loading = null; });
		}
		try {
			const loaded = await loading;
			if (isAbortSignalAborted(signal)) return { ok: false, error: createAbortFailure('advanced').error };
			if (!loaded) return unavailable('The optional advanced provider did not meet the provider contract.');
			provider = loaded;
			return { ok: true, provider };
		} catch (error) {
			return unavailable(error?.message ? 'The optional advanced provider could not be loaded.' : undefined);
		}
	};

	return Object.freeze({
		load,
		getRequirements: () => ADVANCED_BACKGROUND_PROVIDER_REQUIREMENTS,
		isLoaded: () => Boolean(provider),
	});
};
