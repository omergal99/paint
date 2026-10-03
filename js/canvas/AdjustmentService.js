import { applyAdjustment } from './AdjustmentEngine.js';
import { t } from '../i18n/messages.js';

const clipToSelection = (context, selection) => {
	context.beginPath();
	if (Array.isArray(selection.path) && selection.path.length >= 3) {
		context.moveTo(selection.path[0].x, selection.path[0].y);
		selection.path.slice(1).forEach((point) => context.lineTo(point.x, point.y));
		context.closePath();
	} else {
		context.rect(selection.x, selection.y, selection.w, selection.h);
	}
	context.clip();
};

export const createAdjustmentService = ({
	canvasManager,
	historyManager,
	getSelection,
	commitFloatingSelection,
	setSelection,
	persistSession,
	mask,
	documentRef = globalThis.document,
} = {}) => {
	const makePreviewSize = (source) => {
		const limit = 420;
		const scale = Math.min(1, limit / Math.max(source.width, source.height));
		const width = Math.max(1, Math.round(source.width * scale));
		const height = Math.max(1, Math.round(source.height * scale));
		const canvas = documentRef.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Unable to create adjustment preview canvas');
		context.drawImage(source, 0, 0, width, height);
		return canvas;
	};

	const getTargetSource = (target) => {
		if (target === 'selection') {
			const selection = getSelection?.();
			if (!selection?.w || !selection?.h) throw new Error(t('ui.adjustmentNoSelection'));
			if (canvasManager.floatingCanvas) return canvasManager.floatingCanvas;
			return canvasManager.extractRegion(selection);
		}
		if (target === 'brushArea') return canvasManager.createCompositeCanvas();
		return canvasManager.createCompositeCanvas();
	};

	const preview = ({ id, value, target = 'document' } = {}) => {
		const source = makePreviewSize(getTargetSource(target));
		const adjusted = applyAdjustment(source, id, { value }, { documentRef });
		if (target !== 'brushArea' || !mask) return adjusted;
		const maskPreview = documentRef.createElement('canvas');
		maskPreview.width = source.width;
		maskPreview.height = source.height;
		const context = maskPreview.getContext('2d');
		if (!context) throw new Error('Unable to create adjustment mask preview');
		context.drawImage(mask.getCanvas(), 0, 0, source.width, source.height);
		return mask.composite(source, adjusted, { maskSource: maskPreview });
	};

	const applyToSelection = ({ id, value, source, selection }) => {
		const adjusted = applyAdjustment(source, id, { value }, { documentRef });
		const context = canvasManager.ctx;
		context.save();
		clipToSelection(context, selection);
		context.globalCompositeOperation = 'copy';
		context.drawImage(adjusted, selection.x, selection.y);
		context.restore();
		setSelection?.(selection);
	};

	const apply = ({ id, value, target = 'document' } = {}) => {
		const selection = getSelection?.();
		if (target === 'selection' && (!selection?.w || !selection?.h)) {
			throw new Error(t('ui.adjustmentNoSelection'));
		}
		if (target === 'brushArea' && !mask) throw new Error('Brush-area masking is unavailable');
		if (target === 'brushArea' && !mask.hasContent()) throw new Error(t('ui.adjustmentMaskEmpty'));

		if (target === 'selection' && canvasManager.floatingCanvas) {
			if (!historyManager.hasOpenTransaction) historyManager.snapshot({ force: true });
			canvasManager.floatingCanvas = applyAdjustment(canvasManager.floatingCanvas, id, { value }, { documentRef });
			commitFloatingSelection?.();
			persistSession?.();
			return true;
		}

		historyManager.snapshot({ force: true });
		canvasManager.flattenLayers();
		const source = target === 'selection'
			? canvasManager.extractRegion(selection)
			: canvasManager.canvas;
		if (target === 'selection') applyToSelection({ id, value, source, selection });
		else {
			const adjusted = applyAdjustment(source, id, { value }, { documentRef });
			const output = target === 'brushArea' ? mask.composite(source, adjusted) : adjusted;
			if (!canvasManager.loadFromSource(output)) return false;
		}
		persistSession?.();
		return true;
	};

	return Object.freeze({ preview, apply });
};
