import assert from 'node:assert/strict';
import test from 'node:test';

import { initResizeDialog } from '../js/app/resizeDialog.js';

const createElement = ({ value = '', dataset = {}, min = '', max = '' } = {}) => {
	const listeners = new Map();
	const classes = new Set();
	const attributes = new Map();
	const element = {
		dataset,
		min,
		max,
		checked: true,
		textContent: '',
		open: false,
		listeners,
		attributes,
		classList: {
			toggle(name, force) {
				if (force) classes.add(name);
				else classes.delete(name);
				return classes.has(name);
			},
			contains: (name) => classes.has(name),
		},
		addEventListener(type, listener) { listeners.set(type, listener); },
		setAttribute(name, attributeValue) { attributes.set(name, attributeValue); },
		getAttribute(name) { return attributes.get(name) ?? null; },
		dispatch(type, event = {}) { listeners.get(type)?.(event); },
		showModal() { this.open = true; },
		close() {
			this.open = false;
			this.dispatch('close');
		},
	};
	Object.defineProperty(element, 'value', {
		get() { return value; },
		set(next) { value = String(next); },
	});
	return element;
};

const createResizeDialogFixture = ({ selection = null, floatingCanvas = null } = {}) => {
	const elements = {
		'resize-dialog': createElement(),
		'resize-width': createElement({ value: '800', min: '1', max: '10000' }),
		'resize-height': createElement({ value: '600', min: '1', max: '10000' }),
		'resize-percent': createElement({ value: '100', min: '1', max: '1000' }),
		'resize-target-status': createElement(),
		'resize-summary': createElement(),
		'resize-keep-aspect': createElement(),
		'resize-form': createElement(),
		'resize-cancel': createElement(),
	};
	const fixedPresets = [
		createElement({ dataset: { resizePreset: '1024x768' } }),
		createElement({ dataset: { resizePreset: '1000x1000' } }),
	];
	const scalePresets = [50, 75, 100, 125, 150, 200].map((percent) => (
		createElement({ dataset: { resizeScale: String(percent) } })
	));
	const previousDocument = globalThis.document;
	const documentRef = {
		getElementById: (id) => elements[id],
		querySelectorAll: (selector) => (
			selector === '[data-resize-preset]' ? fixedPresets : scalePresets
		),
	};
	globalThis.document = documentRef;

	const resized = [];
	const resampled = [];
	const history = [];
	const status = [];
	const dialogUrls = [];
	const canvasManager = {
		width: 800,
		height: 600,
		selection,
		floatingCanvas,
		isFullCanvasSelection(region = this.selection) {
			return Boolean(region && region.x === 0 && region.y === 0
				&& region.w === this.width && region.h === this.height);
		},
		createCompositeCanvas({ includeFloating = false } = {}) {
			return { width: this.width, height: this.height, includeFloating };
		},
		resize(width, height) {
			resized.push([width, height]);
			this.width = width;
			this.height = height;
			return true;
		},
		resample(options) {
			resampled.push(options);
			this.width = options.width;
			this.height = options.height;
			this.selection = null;
			this.floatingCanvas = null;
			return true;
		},
	};
	const controller = initResizeDialog({
		canvasManager,
		historyManager: { snapshot: () => history.push('snapshot') },
		statusBar: { flash: (message) => status.push(message) },
		setSelection: (region) => { canvasManager.selection = region; },
		commitFloatingSelection: () => {
			if (!canvasManager.floatingCanvas) return;
			history.push('commit-floating');
			canvasManager.floatingCanvas = null;
			canvasManager.selection = null;
		},
		persistSession: () => history.push('persist'),
		setDialogUrl: (value) => dialogUrls.push(value),
	});

	return {
		controller,
		elements,
		fixedPresets,
		scalePresets,
		canvasManager,
		resized,
		resampled,
		history,
		status,
		dialogUrls,
		restoreDocument() {
			if (previousDocument === undefined) delete globalThis.document;
			else globalThis.document = previousDocument;
		},
	};
};

test('dimension inputs preserve blank drafts until blur, then restore the target size', () => {
	const fixture = createResizeDialogFixture();
	try {
		fixture.controller.openResizeDialog();
		const { 'resize-width': width, 'resize-height': height, 'resize-percent': percent, 'resize-summary': summary } = fixture.elements;
		width.value = '';
		width.dispatch('input');

		assert.equal(width.value, '');
		assert.equal(height.value, '600', 'clearing width does not clobber the height draft');
		assert.equal(percent.value, '100', 'clearing width does not force the scale field to its minimum');
		assert.equal(summary.textContent, '', 'the summary does not report invalid draft dimensions');

		width.dispatch('blur');
		assert.equal(width.value, '800');
		assert.equal(height.value, '600');
		assert.match(summary.textContent, /800 × 600/);
	} finally {
		fixture.restoreDocument();
	}
});

test('scale presets apply to the active target and expose their pressed state', () => {
	const fixture = createResizeDialogFixture();
	try {
		fixture.controller.openResizeDialog();
		const halfSize = fixture.scalePresets.find((button) => button.dataset.resizeScale === '50');
		halfSize.dispatch('click');

		assert.equal(fixture.elements['resize-width'].value, '400');
		assert.equal(fixture.elements['resize-height'].value, '300');
		assert.equal(fixture.elements['resize-percent'].value, '50');
		assert.equal(halfSize.getAttribute('aria-pressed'), 'true');
		assert.equal(halfSize.classList.contains('selected'), true);
	} finally {
		fixture.restoreDocument();
	}
});

test('Resize dialog targets the physical canvas for no selection and full-canvas selection', () => {
	for (const selection of [
		null,
		{ x: 0, y: 0, w: 800, h: 600 },
	]) {
		const floatingCanvas = selection ? { width: 800, height: 600 } : null;
		const fixture = createResizeDialogFixture({ selection, floatingCanvas });
		try {
			fixture.controller.openResizeDialog();
			assert.equal(fixture.elements['resize-target-status'].textContent, 'Target: Whole Canvas');
			assert.equal(fixture.elements['resize-target-status'].getAttribute('data-i18n-runtime'), 'ui.resizeTargetWholeCanvas');
			assert.equal(fixture.elements['resize-width'].value, '800');
			assert.equal(fixture.elements['resize-height'].value, '600');

			fixture.scalePresets.find((button) => button.dataset.resizeScale === '75').dispatch('click');
			fixture.elements['resize-form'].dispatch('submit', { preventDefault() {} });

			assert.deepEqual(
				fixture.resampled.map(({ width, height }) => [width, height]),
				[[600, 450]],
			);
			assert.deepEqual(fixture.resized, [], 'whole-canvas scale resamples pixels instead of cropping via bounds-only resize');
			assert.deepEqual(fixture.history, floatingCanvas
				? ['commit-floating', 'snapshot', 'persist']
				: ['snapshot', 'persist']);
			assert.deepEqual([fixture.canvasManager.width, fixture.canvasManager.height], [600, 450]);
		} finally {
			fixture.restoreDocument();
		}
	}
});

test('Resize dialog identifies a partial selection as the active selection target', () => {
	const fixture = createResizeDialogFixture({
		selection: { x: 10, y: 15, w: 40, h: 30 },
		floatingCanvas: { width: 40, height: 30 },
	});
	try {
		fixture.controller.openResizeDialog();
		assert.equal(fixture.elements['resize-target-status'].textContent, 'Target: Active Selection');
		assert.equal(fixture.elements['resize-target-status'].getAttribute('data-i18n-runtime'), 'ui.resizeTargetSelection');
		assert.equal(fixture.elements['resize-width'].value, '40');
		assert.equal(fixture.elements['resize-height'].value, '30');
		fixture.canvasManager.selection = null;
		fixture.controller.openResizeDialog();
		assert.equal(fixture.elements['resize-target-status'].textContent, 'Target: Whole Canvas');
		assert.equal(fixture.elements['resize-target-status'].getAttribute('data-i18n-runtime'), 'ui.resizeTargetWholeCanvas');
	} finally {
		fixture.restoreDocument();
	}
});

test('empty scale drafts retain dimensions and normalize on blur', () => {
	const fixture = createResizeDialogFixture();
	try {
		fixture.controller.openResizeDialog();
		const { 'resize-percent': percent, 'resize-width': width, 'resize-height': height } = fixture.elements;
		percent.value = '';
		percent.dispatch('input');
		assert.equal(width.value, '800');
		assert.equal(height.value, '600');
		assert.equal(percent.value, '');

		percent.dispatch('blur');
		assert.equal(percent.value, '100');
		assert.equal(width.value, '800');
		assert.equal(height.value, '600');
	} finally {
		fixture.restoreDocument();
	}
});

test('submit rounds valid numeric drafts and closes only after resizing succeeds', () => {
	const fixture = createResizeDialogFixture();
	try {
		fixture.controller.openResizeDialog();
		fixture.elements['resize-width'].value = '801.6';
		fixture.elements['resize-height'].value = '601.6';
		let prevented = false;
		fixture.elements['resize-form'].dispatch('submit', {
			preventDefault() { prevented = true; },
		});

		assert.equal(prevented, true);
		assert.deepEqual(fixture.resampled.map(({ width, height }) => [width, height]), [[802, 602]]);
		assert.deepEqual(fixture.resized, []);
		assert.deepEqual(fixture.history, ['snapshot', 'persist']);
		assert.equal(fixture.elements['resize-dialog'].open, false);
	} finally {
		fixture.restoreDocument();
	}
});
