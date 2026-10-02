// js/app/canvasTransforms.js
// Canvas transforms (rotate / flip / crop) plus the rotate-selection handle.
// Phase 3 modularisation: the rotation state this module used to share through
// main.js now lives here, and main.js reaches it only through the exported
// state helpers, so there is exactly one owner for the rotation snapshot.
import { rotateCanvas, rotateCanvasByAngle, flipCanvas, scaleCanvas } from '../utils/transform.js';
import { t } from '../i18n/messages.js';

// Rotation snapshot for the current selection. Kept module-scoped so
// `setSelection` in main.js can prune it without owning the state itself.
let selectionRotation = null;

const sameRegion = (a, b) => {
  return a && b && ['x', 'y', 'w', 'h'].every((key) => a[key] === b[key]);
};

const sameRotationCenter = (a, b) => {
  if (!a || !b) return false;
  return Math.abs((a.x + a.w / 2) - (b.x + b.w / 2)) < 0.5
    && Math.abs((a.y + a.h / 2) - (b.y + b.h / 2)) < 0.5;
};

/**
 * Drop the rotation snapshot when the selection moved somewhere else. Called by
 * `setSelection`, which is the single owner of selection updates.
 */
export const pruneRotationState = (region) => {
  if (selectionRotation && !sameRegion(selectionRotation.selection, region)
    && !sameRotationCenter(selectionRotation.selection, region)) selectionRotation = null;
};

/** Forget the rotation snapshot (commit / discard of a floating selection). */
export const resetRotationState = () => {
  selectionRotation = null;
};

/**
 * @param {object} deps collaborators owned by main.js
 */
export const initCanvasTransforms = ({
  canvasManager,
  historyManager,
  viewportManager,
  dialogService,
  setSelection,
  persistSession,
  crop,
  backgroundRemovalController,
  getActiveToolName,
}) => {
  const rotateSelectionHandle = document.getElementById('selection-rotate');
  let activeSelectionRotationDragCleanup = null;

  const stopSelectionRotationDrag = () => {
    const cleanup = activeSelectionRotationDragCleanup;
    activeSelectionRotationDragCleanup = null;
    cleanup?.();
  };
const applyTransformation = (transformFn) => {
	// A menu transform starts a new operation; do not use a previous rotate
	// handle's base canvas for it.
	selectionRotation = null;
	canvasManager.flattenLayers();
	historyManager.snapshot();
	const selection = canvasManager.selection;
	if (selection && !canvasManager.floatingCanvas) {
		canvasManager.floatingCanvas = canvasManager.extractRegion(selection);
		canvasManager.fillRegion(selection, canvasManager.backgroundColor);
	}
	if (canvasManager.floatingCanvas && canvasManager.selection) {
		const newCanvas = transformFn(canvasManager.floatingCanvas);
		canvasManager.floatingCanvas = newCanvas;

		// Update selection region to match new dimensions
		const sel = canvasManager.selection;
		const cx = sel.x + sel.w / 2;
		const cy = sel.y + sel.h / 2;
		const nw = newCanvas.width;
		const nh = newCanvas.height;

		setSelection({
			x: cx - nw / 2,
			y: cy - nh / 2,
			w: nw,
			h: nh
		});
	} else {
		// Transform entire canvas
		const newCanvas = transformFn(canvasManager.canvas);
		canvasManager.loadFromSource(newCanvas);
	}
	persistSession();
}

document.getElementById('btn-rotate-90').addEventListener('click', () => applyTransformation(c => rotateCanvas(c, 1)));
document.getElementById('btn-rotate-180').addEventListener('click', () => applyTransformation(c => rotateCanvas(c, 2)));
document.getElementById('btn-rotate-270').addEventListener('click', () => applyTransformation(c => rotateCanvas(c, 3)));
document.getElementById('btn-rotate-free').addEventListener('click', async () => {
	const value = await dialogService.prompt({
		title: t('ui.freeRotate'),
		message: t('ui.freeRotatePrompt'),
		value: '15',
		type: 'number',
		confirmLabel: t('ui.rotate'),
	});
	const degrees = Number.parseFloat(value);
	if (Number.isFinite(degrees)) applyTransformation(c => rotateCanvasByAngle(c, degrees));
});
document.getElementById('btn-flip-horizontal').addEventListener('click', () => applyTransformation(c => flipCanvas(c, true)));
document.getElementById('btn-flip-vertical').addEventListener('click', () => applyTransformation(c => flipCanvas(c, false)));
document.getElementById('btn-crop').addEventListener('click', crop);
document.getElementById('btn-remove-bg').addEventListener('click', () => { void backgroundRemovalController.open(); });
const bindRotateSelectionHandle = () => {
	if (!rotateSelectionHandle) return () => {};
	const onClick = (event) => {
		event.preventDefault();
		event.stopPropagation();
		if (rotateSelectionHandle._dragged) {
			rotateSelectionHandle._dragged = false;
			return;
		}
		if (document.getElementById('rotate-selection-toggle')?.checked) {
			rotateSelectionByAngle(90, { prepared: rotateSelectionHandle._rotationPrepared === true });
			rotateSelectionHandle._rotationPrepared = false;
		}
	};
	const onPointerDown = (event) => {
		// `activeToolName` is main.js's module binding; this module only receives the
		// accessor. Reading the bare name threw a ReferenceError here, which killed
		// every pointerdown and so silently disabled drag-rotation (the click path
		// never reads it, which is why clicking still appeared to work).
		if (getActiveToolName() !== 'select' || !document.getElementById('rotate-selection-toggle')?.checked || !canvasManager.selection) return;
		stopSelectionRotationDrag();
		event.preventDefault();
		event.stopPropagation();
		const originalSelection = { ...canvasManager.selection };
		historyManager.snapshot();
		if (!canvasManager.floatingCanvas) {
			canvasManager.floatingCanvas = canvasManager.extractRegion(originalSelection);
			canvasManager.fillRegion(originalSelection, canvasManager.backgroundColor);
			setSelection(originalSelection);
		}
		const rotationState = beginSelectionRotation(originalSelection);
		const startDegrees = rotationState.degrees;
		rotateSelectionHandle._rotationPrepared = true;
		const center = { x: originalSelection.x + originalSelection.w / 2, y: originalSelection.y + originalSelection.h / 2 };
		const startPoint = viewportManager.clientToImage(event.clientX, event.clientY);
		const startAngle = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
		let moved = false;
		const onMove = (moveEvent) => {
			const point = viewportManager.clientToImage(moveEvent.clientX, moveEvent.clientY);
			const angle = Math.atan2(point.y - center.y, point.x - center.x);
			const degrees = snapRotation(startDegrees + (angle - startAngle) * 180 / Math.PI);
			if (Math.abs(degrees - startDegrees) > 1) moved = true;
			rotationState.degrees = degrees;
			const rendered = renderSelectionRotation(rotationState);
			canvasManager.floatingCanvas = rendered.canvas;
			setSelection(rendered.region);
		};
		let finished = false;
		const cleanup = () => {
			if (finished) return;
			finished = true;
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onCancel);
			if (activeSelectionRotationDragCleanup === cleanup) activeSelectionRotationDragCleanup = null;
		};
		const onUp = () => {
			cleanup();
			if (moved) {
				rotateSelectionHandle._dragged = true;
				rotateSelectionHandle._rotationPrepared = false;
				canvasManager.persistToStorage();
			}
		};
		const onCancel = () => cleanup();
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp, { once: true });
		window.addEventListener('pointercancel', onCancel, { once: true });
		activeSelectionRotationDragCleanup = cleanup;
	};
	rotateSelectionHandle.addEventListener('click', onClick);
	rotateSelectionHandle.addEventListener('pointerdown', onPointerDown);
	return () => {
		stopSelectionRotationDrag();
		rotateSelectionHandle.removeEventListener('click', onClick);
		rotateSelectionHandle.removeEventListener('pointerdown', onPointerDown);
	};
};
const destroyRotateSelectionHandleBinding = bindRotateSelectionHandle();

const rotateSelectionByAngle = (degrees, { prepared = false } = {}) => {
	const selection = canvasManager.selection;
	if (!selection?.w || !selection?.h) return;
	if (!prepared) historyManager.snapshot();
	if (!prepared && !canvasManager.floatingCanvas) {
		canvasManager.floatingCanvas = canvasManager.extractRegion(selection);
		canvasManager.fillRegion(selection, canvasManager.backgroundColor);
	}
	const rotationState = beginSelectionRotation(selection);
	rotationState.degrees += degrees;
	rotationState.degrees = snapRotation(rotationState.degrees);
	const rendered = renderSelectionRotation(rotationState);
	canvasManager.floatingCanvas = rendered.canvas;
	setSelection(rendered.region);
	persistSession();
}

const beginSelectionRotation = (selection) => {
	if (!canvasManager.floatingCanvas) return null;
	if (!selectionRotation || !sameRotationCenter(selectionRotation.selection, selection)) {
		selectionRotation = {
			baseCanvas: scaleCanvas(canvasManager.floatingCanvas, canvasManager.floatingCanvas.width, canvasManager.floatingCanvas.height),
			selection: { ...selection },
			center: { x: selection.x + selection.w / 2, y: selection.y + selection.h / 2 },
			degrees: 0,
		};
	}
	return selectionRotation;
}

const snapRotation = (degrees) => {
	const quarterTurn = Math.round(degrees / 90) * 90;
	return Math.abs(degrees - quarterTurn) < 0.75 ? quarterTurn : degrees;
}

const renderSelectionRotation = (rotationState) => {
	const { center, degrees, baseCanvas } = rotationState;
	const quarterTurn = Math.round(degrees / 90) * 90;
	// Always rotate the untouched source at its natural size. Fitting an
	// already-rotated canvas into the old rectangle changes the shape's scale
	// and can clip its corners. The resulting canvas is the true rotated
	// bounding box, so the selection travels with the pixels.
	const canvas = rotateCanvasByAngle(baseCanvas, degrees);
	return {
		canvas,
		region: {
			x: center.x - canvas.width / 2,
			y: center.y - canvas.height / 2,
			w: canvas.width,
			h: canvas.height,
		},
	};
}


  return Object.freeze({
    applyTransformation,
    rotateSelectionByAngle,
    destroyRotateSelectionHandleBinding,
  });
};
