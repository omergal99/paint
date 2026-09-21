import assert from 'node:assert/strict';
import test from 'node:test';

import {
	BACKGROUND_REMOVAL_ERROR_CODES,
	BACKGROUND_REMOVAL_PROVIDER_IDS,
	createBackgroundRemovalService,
	createBackgroundRemovalSuccess,
} from '../js/background/BackgroundRemovalProvider.js';
import { createLocalColorKeyProvider } from '../js/background/LocalColorKeyProvider.js';
import { createBackgroundRemovalController } from '../js/background/BackgroundRemovalController.js';
import {
	createAdvancedProviderLoader,
	createSelfHostedAdvancedProviderImporter,
} from '../js/background/AdvancedProviderLoader.js';

const pngBlob = (contents = 'png') => new Blob([contents], { type: 'image/png' });

const createStubProvider = ({
	id = BACKGROUND_REMOVAL_PROVIDER_IDS.local,
	width = 4,
	height = 4,
	remove = null,
	privacy = { uploadsImage: false },
} = {}) => ({
	id,
	privacy,
	inspectInput: async () => ({ width, height }),
	remove: remove || (async () => createBackgroundRemovalSuccess({
		providerId: id,
		imageBlob: pngBlob(),
		width,
		height,
	})),
});

const uiElement = () => {
	const listeners = new Map();
	const element = {
		hidden: false,
		disabled: false,
		value: 0,
		textContent: '',
		attributes: {},
		addEventListener: (name, listener) => listeners.set(name, listener),
		removeEventListener: (name) => listeners.delete(name),
		dispatch: (name, event = {}) => listeners.get(name)?.(event),
		setAttribute: (name, value) => { element.attributes[name] = value; },
		removeAttribute: () => {},
	};
	return element;
};

test('background-removal service returns a bounded local result', async () => {
	const localProvider = createStubProvider();
	const service = createBackgroundRemovalService({ localProvider });
	const result = await service.remove(pngBlob());
	assert.equal(result.ok, true);
	assert.equal(result.providerId, BACKGROUND_REMOVAL_PROVIDER_IDS.local);
	assert.equal(result.width, 4);
	assert.equal(result.height, 4);
	assert.equal(result.imageBlob.type, 'image/png');
});

test('background-removal controller previews, applies, and releases its object URL', async () => {
	const dialog = uiElement();
	dialog.open = false;
	dialog.showModal = () => { dialog.open = true; };
	dialog.close = () => { dialog.open = false; };
	const message = uiElement();
	const phase = uiElement();
	const progress = uiElement();
	const preview = uiElement();
	const applyButton = uiElement();
	const cancelButton = uiElement();
	const closeButton = uiElement();
	const imageBlob = pngBlob('result');
	const revoked = [];
	let applied = null;
	const controller = createBackgroundRemovalController({
		dialog, message, phase, progress, preview, applyButton, cancelButton, closeButton,
		service: { remove: async (_blob, options) => {
			options.onProgress({ phase: 'remove', completed: 1, total: 1 });
			return { ok: true, imageBlob, width: 4, height: 4, providerId: 'local-color-key' };
		} },
		getInput: async () => ({ blob: pngBlob('input'), region: { x: 1, y: 2, w: 4, h: 4 } }),
		applyResult: async (result) => { applied = result; return true; },
		urlApi: { createObjectURL: () => 'blob:preview', revokeObjectURL: (url) => revoked.push(url) },
	});

	assert.equal(await controller.open(), true);
	assert.equal(preview.hidden, false);
	assert.equal(preview.src, 'blob:preview');
	assert.equal(applyButton.disabled, false);
	assert.equal(progress.value, 100);
	applyButton.dispatch('click');
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(applied.region.w, 4);
	assert.deepEqual(revoked, ['blob:preview']);
	controller.destroy();
});

test('background-removal service rejects oversized decoded input before provider processing', async () => {
	let removeCalls = 0;
	const localProvider = createStubProvider({
		width: 4096,
		height: 4097,
		remove: async () => {
			removeCalls += 1;
			return createBackgroundRemovalSuccess({
				providerId: BACKGROUND_REMOVAL_PROVIDER_IDS.local,
				imageBlob: pngBlob(),
				width: 4096,
				height: 4097,
			});
		},
	});
	const result = await createBackgroundRemovalService({ localProvider }).remove(pngBlob());
	assert.equal(result.ok, false);
	assert.equal(result.error.code, BACKGROUND_REMOVAL_ERROR_CODES.inputPixelLimit);
	assert.equal(removeCalls, 0);
});

test('background-removal service times out and aborts the provider signal', async () => {
	let sawAbort = false;
	const localProvider = createStubProvider({
		remove: async (_blob, _options, signal) => new Promise((resolve) => {
			signal.addEventListener('abort', () => {
				sawAbort = true;
				resolve(createBackgroundRemovalSuccess({
					providerId: BACKGROUND_REMOVAL_PROVIDER_IDS.local,
					imageBlob: pngBlob(),
					width: 4,
					height: 4,
				}));
			}, { once: true });
		}),
	});
	const result = await createBackgroundRemovalService({ localProvider }).remove(pngBlob(), { timeoutMs: 5 });
	assert.equal(result.ok, false);
	assert.equal(result.error.code, BACKGROUND_REMOVAL_ERROR_CODES.timeout);
	assert.equal(sawAbort, true);
});

test('advanced loader is inert until an explicit choice and caches one approved import', async () => {
	let imports = 0;
	const advancedProvider = createStubProvider({ id: 'advanced-test' });
	const loader = createAdvancedProviderLoader({
		importProvider: async () => {
			imports += 1;
			return { createAdvancedBackgroundRemovalProvider: () => advancedProvider };
		},
	});
	const notChosen = await loader.load();
	assert.equal(notChosen.ok, false);
	assert.equal(notChosen.error.code, BACKGROUND_REMOVAL_ERROR_CODES.advancedOptInRequired);
	assert.equal(imports, 0);

	const service = createBackgroundRemovalService({
		localProvider: createStubProvider(),
		advancedProviderLoader: loader,
	});
	const rejected = await service.remove(pngBlob(), { providerId: BACKGROUND_REMOVAL_PROVIDER_IDS.advanced });
	assert.equal(rejected.error.code, BACKGROUND_REMOVAL_ERROR_CODES.advancedOptInRequired);
	assert.equal(imports, 0);

	const accepted = await service.remove(pngBlob(), {
		providerId: BACKGROUND_REMOVAL_PROVIDER_IDS.advanced,
		advancedOptIn: true,
	});
	assert.equal(accepted.ok, true);
	assert.equal(accepted.providerId, 'advanced-test');
	assert.equal(imports, 1);
	assert.equal(loader.isLoaded(), true);
});

test('an oversized encoded image is rejected before the advanced importer can run', async () => {
	let imports = 0;
	const loader = createAdvancedProviderLoader({
		importProvider: async () => {
			imports += 1;
			return { createAdvancedBackgroundRemovalProvider: () => createStubProvider({ id: 'advanced-test' }) };
		},
	});
	const result = await createBackgroundRemovalService({
		localProvider: createStubProvider(),
		advancedProviderLoader: loader,
		limits: { maxInputBytes: 2 },
	}).remove(pngBlob('too-large'), {
		providerId: BACKGROUND_REMOVAL_PROVIDER_IDS.advanced,
		advancedOptIn: true,
	});
	assert.equal(result.ok, false);
	assert.equal(result.error.code, BACKGROUND_REMOVAL_ERROR_CODES.inputTooLarge);
	assert.equal(imports, 0);
});

test('local color-key fallback processes pixels locally and releases decoded input', async () => {
	const pixels = new Uint8ClampedArray([
		10, 10, 10, 255,
		200, 0, 0, 255,
	]);
	let closed = 0;
	let written = null;
	const bitmap = { width: 2, height: 1, close: () => { closed += 1; } };
	const canvas = {
		getContext: () => ({
			drawImage: () => {},
			getImageData: () => ({ data: pixels }),
			putImageData: (imageData) => { written = imageData.data; },
		}),
		toBlob: (callback) => callback(pngBlob('local-output')),
	};
	const provider = createLocalColorKeyProvider({
		createImageBitmapFn: async () => bitmap,
		createCanvas: () => canvas,
	});
	const result = await provider.remove(pngBlob(), { tolerance: 10 });
	assert.equal(result.ok, true);
	assert.equal(written[3], 0, 'the sampled background becomes transparent');
	assert.equal(written[7], 255, 'different foreground pixels remain opaque');
	assert.equal(closed, 1, 'the decoded bitmap is released');
	assert.equal(provider.privacy.uploadsImage, false);
});

test('local color-key fallback returns a standard decode error instead of throwing', async () => {
	const provider = createLocalColorKeyProvider({
		createImageBitmapFn: async () => { throw new Error('bad image'); },
	});
	const result = await provider.remove(pngBlob());
	assert.equal(result.ok, false);
	assert.equal(result.error.code, BACKGROUND_REMOVAL_ERROR_CODES.decodeFailed);
});

test('advanced importer factory only accepts self-hosted relative module paths', () => {
	assert.equal(createSelfHostedAdvancedProviderImporter('https://example.test/provider.js'), null);
	assert.equal(typeof createSelfHostedAdvancedProviderImporter('./advanced/provider.js'), 'function');
});
