import { ADJUSTMENTS, ADJUSTMENT_PRESETS } from '../canvas/AdjustmentEngine.js';
import { t } from '../i18n/messages.js';

const setLabel = (node, key) => {
	node.textContent = t(key);
	node.setAttribute('data-i18n-runtime', key);
};

export const createAdjustmentsDialog = ({
	dialog,
	adjustmentSelect,
	targetSelect,
	valueInput,
	valueNumberInput,
	valueOutput,
	targetButtons = [],
	previewCanvas,
	applyButton,
	resetButton,
	cancelButton,
	paintMaskButton,
	clearMaskButton,
	invertMaskButton,
	errorMessage,
	apply,
	preview,
	onPaintMask,
	onClearMask,
	onInvertMask,
	onCancel,
	onApplied,
	onValueChange,
	getValue,
	hasSelection,
	hasBrushMask,
	onError,
} = {}) => {
	if (!dialog || !adjustmentSelect || !valueInput || !previewCanvas) {
		throw new TypeError('Adjustments dialog is missing required controls');
	}
	let currentId = adjustmentSelect.value || 'brightness';
	let currentValue = getValue?.(currentId) ?? ADJUSTMENTS[currentId]?.defaultValue ?? 100;
	let frame = null;
	let returnFocus = null;
	let applied = false;
	let cancelHandled = false;
	let preserveMaskOnClose = false;

	const currentMetadata = () => ADJUSTMENTS[currentId];
	const renderSlider = () => {
		const metadata = currentMetadata();
		valueInput.min = String(metadata.min);
		valueInput.max = String(metadata.max);
		valueInput.step = '1';
		valueInput.disabled = metadata.kind === 'pattern';
		valueInput.value = String(currentValue);
		if (valueNumberInput) {
			valueNumberInput.min = String(metadata.min);
			valueNumberInput.max = String(metadata.max);
			valueNumberInput.step = '1';
			valueNumberInput.disabled = metadata.kind === 'pattern';
			valueNumberInput.value = String(currentValue);
		}
		valueInput.setAttribute('aria-valuetext', `${currentValue}`);
		valueOutput.value = `${currentValue}`;
	};

	const drawPreview = () => {
		frame = null;
		try {
			const canvas = preview({ id: currentId, value: currentValue, target: targetSelect.value });
			previewCanvas.width = canvas.width;
			previewCanvas.height = canvas.height;
			const context = previewCanvas.getContext('2d');
			context.clearRect(0, 0, canvas.width, canvas.height);
			context.drawImage(canvas, 0, 0);
			if (errorMessage) errorMessage.textContent = '';
		} catch (error) {
			if (errorMessage) errorMessage.textContent = error.message;
			onError?.(error);
		}
	};

	const schedulePreview = () => {
		if (frame !== null) cancelAnimationFrame(frame);
		frame = requestAnimationFrame(drawPreview);
	};

	const updateScopeControls = () => {
		const scoped = targetSelect.value === 'selection';
		const brushArea = targetSelect.value === 'brushArea';
		[...targetSelect.options].forEach((option) => {
			if (option.value === 'selection') option.disabled = !hasSelection?.();
		});
		targetButtons.forEach((button) => {
			const target = button.dataset.adjustmentTarget;
			button.setAttribute('aria-pressed', String(target === targetSelect.value));
			button.disabled = target === 'selection' && !hasSelection?.();
		});
		paintMaskButton.hidden = !brushArea;
		clearMaskButton.hidden = !brushArea;
		invertMaskButton.hidden = !brushArea;
		applyButton.disabled = (scoped && !hasSelection?.())
			|| (brushArea && !hasBrushMask?.());
	};

	const setTarget = () => {
		if (targetSelect.value === 'selection' && !hasSelection?.()) {
			targetSelect.value = 'document';
		}
		updateScopeControls();
		schedulePreview();
	};

	const setValue = (rawValue) => {
		if (rawValue === '' || !Number.isFinite(Number(rawValue))) return;
		const metadata = currentMetadata();
		currentValue = Math.max(metadata.min, Math.min(metadata.max, Math.round(Number(rawValue))));
		renderSlider();
		onValueChange?.({ id: currentId, value: currentValue });
		schedulePreview();
	};

	const setAdjustment = () => {
		currentId = adjustmentSelect.value;
		currentValue = getValue?.(currentId) ?? currentMetadata().defaultValue;
		const presetValue = Object.values(ADJUSTMENT_PRESETS)
			.find((preset) => Object.hasOwn(preset, currentId))?.[currentId];
		if (getValue?.(currentId) === undefined && Number.isFinite(presetValue)) currentValue = presetValue;
		renderSlider();
		schedulePreview();
	};

	const open = ({ id } = {}) => {
		if (id && ADJUSTMENTS[id]) {
			adjustmentSelect.value = id;
			setAdjustment();
		}
		returnFocus = document.activeElement;
		applied = false;
		cancelHandled = false;
		preserveMaskOnClose = false;
		updateScopeControls();
		renderSlider();
		schedulePreview();
		if (!dialog.open) dialog.showModal();
		adjustmentSelect.focus();
	};

	const close = () => {
		if (frame !== null) cancelAnimationFrame(frame);
		frame = null;
		if (dialog.open) dialog.close();
		returnFocus?.focus?.();
		returnFocus = null;
	};
	const handleCancel = () => {
		if (cancelHandled || applied || preserveMaskOnClose) return;
		cancelHandled = true;
		onCancel?.();
	};

	adjustmentSelect.addEventListener('change', setAdjustment);
	targetSelect.addEventListener('change', setTarget);
	valueInput.addEventListener('input', () => {
		setValue(valueInput.value);
	});
	valueNumberInput?.addEventListener('input', () => {
		setValue(valueNumberInput.value);
	});
	targetButtons.forEach((button) => button.addEventListener('click', () => {
		if (button.disabled) return;
		targetSelect.value = button.dataset.adjustmentTarget;
		const EventConstructor = targetSelect.ownerDocument?.defaultView?.Event || globalThis.Event;
		targetSelect.dispatchEvent(new EventConstructor('change', { bubbles: true }));
	}));
	resetButton.addEventListener('click', () => {
		currentValue = currentMetadata().defaultValue;
		renderSlider();
		onValueChange?.({ id: currentId, value: currentValue });
		schedulePreview();
	});
	applyButton.addEventListener('click', () => {
		try {
			const applyResult = apply({ id: currentId, value: currentValue, target: targetSelect.value });
			if (applyResult === false) return;
			applied = true;
			onApplied?.({ id: currentId, value: currentValue, target: targetSelect.value });
			close();
		} catch (error) {
			if (errorMessage) errorMessage.textContent = error.message;
			onError?.(error);
		}
	});
	cancelButton.addEventListener('click', () => {
		handleCancel();
		close();
	});
	paintMaskButton.addEventListener('click', () => {
		preserveMaskOnClose = true;
		close();
		onPaintMask?.();
	});
	clearMaskButton.addEventListener('click', () => {
		onClearMask?.();
		schedulePreview();
	});
	invertMaskButton.addEventListener('click', () => {
		onInvertMask?.();
		schedulePreview();
	});
	dialog.addEventListener('cancel', handleCancel);
	dialog.addEventListener('close', () => {
		handleCancel();
		returnFocus?.focus?.();
		returnFocus = null;
	});

	return Object.freeze({
		open,
		close,
		refresh: schedulePreview,
		getDraft: () => Object.freeze({
			id: currentId,
			value: currentValue,
			target: targetSelect.value,
		}),
		destroy: () => {
			if (frame !== null) cancelAnimationFrame(frame);
			frame = null;
			dialog.removeEventListener('cancel', handleCancel);
			if (dialog.open) dialog.close();
		},
	});
};

export const createAdjustmentOption = ({ documentRef = document, id, labelKey } = {}) => {
	const option = documentRef.createElement('option');
	option.value = id;
	setLabel(option, labelKey);
	return option;
};
