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
import { createBackgroundMaskEditor } from '../js/background/BackgroundMaskEditor.js';
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

test('background mask editor captures preview drags and emits normalized keep regions', () => {
	const listeners = new Map();
	const document = { createElement: () => ({ style: {}, dataset: {}, setAttribute: () => {} }) };
	const overlay = { ownerDocument: document, replaceChildren: () => {}, append: () => {} };
	const root = {
		ownerDocument: document,
		dataset: {},
		getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
		addEventListener: (name, listener) => listeners.set(name, listener),
		removeEventListener: (name) => listeners.delete(name),
		setPointerCapture: () => {},
		releasePointerCapture: () => {},
	};
	const editor = createBackgroundMaskEditor({ root, overlay });
	let stopped = false;
	const event = (x, y) => ({ button: 0, pointerId: 1, clientX: x, clientY: y, preventDefault: () => {}, stopPropagation: () => { stopped = true; } });
	listeners.get('pointerdown')(event(10, 20));
	listeners.get('pointerup')(event(60, 80));
	assert.equal(stopped, true);
	assert.deepEqual(editor.getRegions().keepRegions[0], { x: 0.1, y: 0.2, w: 0.5, h: 0.6 });
	editor.destroy();
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

test('background-removal controller can re-preview with current options without mutating until Apply', async () => {
	const dialog = uiElement();
	dialog.open = false;
	dialog.showModal = () => { dialog.open = true; };
	dialog.close = () => { dialog.open = false; };
	const previewButton = uiElement();
	const applyButton = uiElement();
	let calls = 0;
	let seenTolerance = null;
	const controller = createBackgroundRemovalController({
		dialog, message: uiElement(), phase: uiElement(), progress: uiElement(), preview: uiElement(),
		applyButton, previewButton, cancelButton: uiElement(), closeButton: uiElement(),
		service: { remove: async (_blob, options) => {
			calls += 1;
			seenTolerance = options.tolerance;
			return { ok: true, imageBlob: pngBlob(`preview-${calls}`), width: 1, height: 1, providerId: 'local-color-key' };
		} },
		getInput: async () => ({ blob: pngBlob('input'), target: 'canvas' }),
		getOptions: () => ({ tolerance: 77, mode: 'flood-fill' }),
		applyResult: async () => true,
	});
	assert.equal(await controller.open(), true);
	assert.equal(calls, 1);
	previewButton.dispatch('click', { preventDefault() {} });
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(calls, 2);
	assert.equal(seenTolerance, 77);
	assert.equal(applyButton.disabled, false);
	controller.destroy();
});

test('background-removal controller keeps the previous preview visible during a re-preview', async () => {
	const dialog = uiElement();
	dialog.open = false;
	dialog.showModal = () => { dialog.open = true; };
	dialog.close = () => { dialog.open = false; };
	const preview = uiElement();
	const previewButton = uiElement();
	let calls = 0;
	let resolveSecond;
	const controller = createBackgroundRemovalController({
		dialog, message: uiElement(), phase: uiElement(), progress: uiElement(), preview,
		previewButton, applyButton: uiElement(), cancelButton: uiElement(), closeButton: uiElement(),
		service: { remove: async () => {
			calls += 1;
			if (calls === 2) await new Promise((resolve) => { resolveSecond = resolve; });
			return { ok: true, imageBlob: pngBlob(`keep-${calls}`), width: 1, height: 1, providerId: 'local-color-key' };
		} },
		getInput: async () => ({ blob: pngBlob('input') }),
		urlApi: { createObjectURL: (blob) => `blob:${blob.size}:${calls}`, revokeObjectURL: () => {} },
	});
	await controller.open();
	assert.equal(preview.hidden, false);
	previewButton.dispatch('click', { preventDefault() {} });
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(preview.hidden, false);
	resolveSecond();
	await new Promise((resolve) => setTimeout(resolve, 0));
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

test('local color-key accepts an explicit background color', async () => {
	const pixels = new Uint8ClampedArray([
		200, 0, 0, 255,
		0, 0, 200, 255,
	]);
	let written = null;
	const bitmap = { width: 2, height: 1, close: () => {} };
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
	const result = await provider.remove(pngBlob(), { backgroundColor: '#0000c8' });
	assert.equal(result.ok, true);
	assert.equal(written[3], 255, 'a non-background pixel remains opaque');
	assert.equal(written[7], 0, 'the selected background color becomes transparent');
});

test('local flood-fill mode removes only background-connected pixels', async () => {
	const pixels = new Uint8ClampedArray([
		10, 10, 10, 255, 10, 10, 10, 255, 10, 10, 10, 255,
		10, 10, 10, 255, 200, 0, 0, 255, 10, 10, 10, 255,
		10, 10, 10, 255, 10, 10, 10, 255, 10, 10, 10, 255,
	]);
	let written = null;
	const bitmap = { width: 3, height: 3, close: () => {} };
	const canvas = {
		getContext: () => ({
			drawImage: () => {},
			getImageData: () => ({ data: pixels }),
			putImageData: (imageData) => { written = imageData.data; },
		}),
		toBlob: (callback) => callback(pngBlob('flood-output')),
	};
	const provider = createLocalColorKeyProvider({
		createImageBitmapFn: async () => bitmap,
		createCanvas: () => canvas,
		chunkPixels: 1,
	});
	const result = await provider.remove(pngBlob(), { mode: 'flood-fill', tolerance: 0 });
	assert.equal(result.ok, true);
	assert.equal(written[4 * 4 + 3], 255, 'a different-colored subject remains opaque');
	assert.equal(written[3], 0, 'connected edge background becomes transparent');
});

test('local provider applies normalized keep/remove mask regions after segmentation', async () => {
	const pixels = new Uint8ClampedArray([
		10, 10, 10, 255, 200, 0, 0, 255,
	]);
	let written = null;
	const bitmap = { width: 2, height: 1, close: () => {} };
	const canvas = {
		getContext: () => ({ drawImage: () => {}, getImageData: () => ({ data: pixels }), putImageData: (value) => { written = value.data; } }),
		toBlob: (callback) => callback(pngBlob('mask-output')),
	};
	const provider = createLocalColorKeyProvider({ createImageBitmapFn: async () => bitmap, createCanvas: () => canvas });
	const result = await provider.remove(pngBlob(), {
		tolerance: 100,
		keepRegions: [{ x: 0.5, y: 0, w: 0.5, h: 1 }],
		removeRegions: [{ x: 0, y: 0, w: 0.5, h: 1 }],
	});
	assert.equal(result.ok, true);
	assert.equal(written[3], 0, 'remove region is transparent');
	assert.equal(written[7], 255, 'keep region restores original alpha');
});

test('local soft-edge mode produces feathered alpha instead of a hard cut', async () => {
	const pixels = new Uint8ClampedArray([100, 100, 100, 255]);
	let written = null;
	const bitmap = { width: 1, height: 1, close: () => {} };
	const canvas = {
		getContext: () => ({ drawImage: () => {}, getImageData: () => ({ data: pixels }), putImageData: (value) => { written = value.data; } }),
		toBlob: (callback) => callback(pngBlob('soft-output')),
	};
	const provider = createLocalColorKeyProvider({ createImageBitmapFn: async () => bitmap, createCanvas: () => canvas });
	const result = await provider.remove(pngBlob(), {
		mode: 'soft-edge', tolerance: 20, edgeSoftness: 20, backgroundColor: '#4b4b4b',
	});
	assert.equal(result.ok, true);
	assert.ok(written[3] > 0 && written[3] < 255, 'soft edge keeps a partial alpha');
});

test('advanced importer factory only accepts self-hosted relative module paths', () => {
	assert.equal(createSelfHostedAdvancedProviderImporter('https://example.test/provider.js'), null);
	assert.equal(typeof createSelfHostedAdvancedProviderImporter('./advanced/provider.js'), 'function');
});
