import { paintSelectionFrame, readSelectionAppearance } from '../services/selection/selectionAppearance.js';
import { fitPathToBounds } from '../services/selection/selectionGeometry.js';
import { scaleCanvas } from '../utils/transform.js';

export const createSelectionOverlayController = ({
	canvasManager,
	viewportManager,
	historyManager = null,
	setSelection,
	isToolActive,
	isPreviewActive,
	documentRef = globalThis.document,
	windowRef = globalThis.window,
	getComputedStyleRef = globalThis.getComputedStyle,
} = {}) => {
	const handles = [...documentRef.querySelectorAll('[data-selection-handle]')];
	const rotateHandle = documentRef.getElementById('selection-rotate');
	const actionsBar = documentRef.querySelector('.selection-overlay-actions');
	let activeDragCleanup = null;
	let activeDragCancel = null;

	const drawSelectionOutline = (region) => paintSelectionFrame(canvasManager.octx, region, {
		appearance: readSelectionAppearance(),
		active: Boolean(canvasManager.floatingCanvas),
		preview: isPreviewActive(),
		zoom: viewportManager.zoom / 100,
	});

	const stopDrag = () => {
		activeDragCancel?.();
		activeDragCleanup?.();
	};

	const updateSelectionHandles = (region) => {
		const hidden = isPreviewActive() || !isToolActive() || !region || !region.w || !region.h;
		handles.forEach((handle) => { handle.hidden = hidden; });
		if (actionsBar) {
			const visible = !hidden;
			actionsBar.hidden = !visible;
			if (visible) {
				actionsBar.style.left = `${region.x + region.w / 2}px`;
				actionsBar.style.top = `${Math.max(0, region.y - 40)}px`;
			}
		}
		if (rotateHandle) {
			rotateHandle.hidden = hidden || !documentRef.getElementById('rotate-selection-toggle')?.checked;
		}
		if (hidden) return;

		const points = {
			nw: [region.x, region.y], n: [region.x + region.w / 2, region.y], ne: [region.x + region.w, region.y],
			e: [region.x + region.w, region.y + region.h / 2], se: [region.x + region.w, region.y + region.h],
			s: [region.x + region.w / 2, region.y + region.h], sw: [region.x, region.y + region.h],
			w: [region.x, region.y + region.h / 2],
		};
		const value = getComputedStyleRef(documentRef.documentElement)
			.getPropertyValue('--selection-handle-size').trim();
		const size = parseFloat(value);
		const half = (Number.isFinite(size) ? size : 9) / 2;
		handles.forEach((handle) => {
			const [x, y] = points[handle.dataset.selectionHandle];
			handle.style.left = `${x - half}px`;
			handle.style.top = `${y - half}px`;
		});
	};

	const bindSelectionHandles = () => {
		const bindings = [];
		handles.forEach((handle) => {
			const onPointerDown = (event) => {
				stopDrag();
				event.preventDefault();
				event.stopPropagation();
				const original = { ...canvasManager.selection };
				const wholeCanvas = !canvasManager.floatingCanvas
					&& original.x === 0 && original.y === 0
					&& original.w === canvasManager.width && original.h === canvasManager.height;
				const originalSource = wholeCanvas ? documentRef.createElement('canvas') : null;
				if (originalSource) {
					originalSource.width = canvasManager.width;
					originalSource.height = canvasManager.height;
					const sourceContext = originalSource.getContext('2d');
					if (!sourceContext) return;
					sourceContext.drawImage(canvasManager.createCompositeCanvas(), 0, 0);
					historyManager?.beginTransaction?.();
				}
				const originalFloating = canvasManager.floatingCanvas
					? documentRef.createElement('canvas')
					: null;
				if (originalFloating) {
					originalFloating.width = canvasManager.floatingCanvas.width;
					originalFloating.height = canvasManager.floatingCanvas.height;
					const sourceContext = originalFloating.getContext('2d');
					if (!sourceContext) return;
					sourceContext.drawImage(canvasManager.floatingCanvas, 0, 0);
				}
				const wasClean = wholeCanvas && canvasManager.isCleanDocument?.();
				let canvasResized = false;
				const direction = handle.dataset.selectionHandle;
				const fixed = {
					x: direction.includes('w') ? original.x + original.w : original.x,
					y: direction.includes('n') ? original.y + original.h : original.y,
				};
				const onMove = (moveEvent) => {
					const point = viewportManager.clientToImage(moveEvent.clientX, moveEvent.clientY);
					let x = original.x;
					let y = original.y;
					let w = original.w;
					let h = original.h;
					if (direction.includes('e')) w = Math.max(1, Math.round(point.x - original.x));
					if (direction.includes('w')) { w = Math.max(1, Math.round(fixed.x - point.x)); x = fixed.x - w; }
					if (direction.includes('s')) h = Math.max(1, Math.round(point.y - original.y));
					if (direction.includes('n')) { h = Math.max(1, Math.round(fixed.y - point.y)); y = fixed.y - h; }
					if (moveEvent.shiftKey && w > 0 && h > 0) {
						const ratio = original.w / Math.max(1, original.h);
						if (direction.length === 1) {
							if (direction === 'e' || direction === 'w') h = Math.max(1, Math.round(w / ratio));
							else w = Math.max(1, Math.round(h * ratio));
						} else if (w / h > ratio) w = Math.max(1, Math.round(h * ratio));
						else h = Math.max(1, Math.round(w / ratio));
						if (direction.includes('w')) x = fixed.x - w;
						if (direction.includes('n')) y = fixed.y - h;
					}
					if (wholeCanvas) {
						if (w === canvasManager.width && h === canvasManager.height) return;
						if (!canvasManager.resample({ source: originalSource, width: w, height: h })) return;
						canvasResized = true;
						historyManager?.setTransactionChanged?.(true);
						x = 0;
						y = 0;
						w = canvasManager.width;
						h = canvasManager.height;
					} else if (originalFloating) {
						canvasManager.floatingCanvas = scaleCanvas(originalFloating, w, h);
					}
					const nextBounds = { x, y, w, h };
					setSelection({
						...nextBounds,
						path: fitPathToBounds(original.path, original, nextBounds),
					}, { preview: true });
				};
				let finished = false;
				const cleanup = () => {
					if (finished) return;
					finished = true;
					windowRef.removeEventListener('pointermove', onMove);
					windowRef.removeEventListener('pointerup', onUp);
					windowRef.removeEventListener('pointercancel', onCancel);
					if (activeDragCleanup === cleanup) activeDragCleanup = null;
					if (activeDragCancel === cancel) activeDragCancel = null;
				};
				const onUp = () => {
					cleanup();
					if (wholeCanvas) {
						historyManager?.setTransactionChanged?.(canvasResized);
						historyManager?.commitTransaction?.();
					}
					canvasManager.persistToStorage();
				};
				const cancel = () => {
					cleanup();
					if (wholeCanvas) {
						if (canvasResized) {
							const restored = canvasManager.resample({
								source: originalSource,
								width: original.w,
								height: original.h,
							});
							if (restored) {
								setSelection(original);
								if (wasClean) canvasManager.resetCleanBaseline?.();
							} else {
								historyManager?.setTransactionChanged?.(true);
								historyManager?.commitTransaction?.();
								canvasManager.persistToStorage();
								return;
							}
						}
						historyManager?.abortTransaction?.();
					}
				};
				const onCancel = () => cancel();
				windowRef.addEventListener('pointermove', onMove);
				windowRef.addEventListener('pointerup', onUp, { once: true });
				windowRef.addEventListener('pointercancel', onCancel, { once: true });
				activeDragCleanup = cleanup;
				activeDragCancel = cancel;
			};
			handle.addEventListener('pointerdown', onPointerDown);
			bindings.push(() => handle.removeEventListener('pointerdown', onPointerDown));
		});
		return () => {
			stopDrag();
			bindings.forEach((unbind) => unbind());
		};

	};

	return Object.freeze({
		drawSelectionOutline,
		updateSelectionHandles,
		bindSelectionHandles,
	});
};
