import { SELECTION_MODES } from '../core/constants.js';
import {
	appendLassoPoint,
	getPathBounds,
	isPointInPath,
	translatePath,
} from '../services/selection/selectionGeometry.js';

const inside = (point, selection) => point.x >= selection.x && point.x <= selection.x + selection.w
	&& point.y >= selection.y && point.y <= selection.y + selection.h;

export const createSelectTool = ({
	requestFrame = globalThis.requestAnimationFrame?.bind(globalThis) ?? ((callback) => setTimeout(callback, 0)),
	cancelFrame = globalThis.cancelAnimationFrame?.bind(globalThis) ?? clearTimeout,
} = {}) => {
	const state = {
		mode: SELECTION_MODES.rectangle,
		start: null,
		moving: false,
		liftedOrigin: null,
		originalSelection: null,
		path: [],
		pendingFrame: null,
	};

	const cancelPreview = () => {
		if (state.pendingFrame === null) return;
		cancelFrame(state.pendingFrame);
		state.pendingFrame = null;
	};

	const updateLassoPreview = (ctx) => {
		if (state.pendingFrame !== null) return;
		state.pendingFrame = requestFrame(() => {
			state.pendingFrame = null;
			const bounds = getPathBounds(state.path);
			if (bounds) ctx.setSelection({ ...bounds, path: [...state.path] });
		});
	};

	const clampPoint = (point, canvasManager) => ({
		x: Math.max(0, Math.min(canvasManager.width, point.x)),
		y: Math.max(0, Math.min(canvasManager.height, point.y)),
	});

	const onActivate = (ctx) => {
		state.start = null;
		state.moving = false;
		state.path = [];
		state.originalSelection = null;
		ctx.setMarqueeStatus?.(false);
	};

	const onDeactivate = (ctx) => {
		cancelPreview();
		ctx.setMarqueeStatus?.(false);
		ctx.commitFloatingSelection();
	};

	const onDown = (point, ctx) => {
		ctx.flattenLayers?.();
		const selection = ctx.getSelection();
		const hitsSelection = selection && (
			Array.isArray(selection.path) ? isPointInPath(point, selection.path) : inside(point, selection)
		);
		if (hitsSelection) {
			state.moving = true;
			state.start = point;
			state.liftedOrigin = { x: selection.x, y: selection.y };
			state.originalSelection = {
				...selection,
				path: Array.isArray(selection.path) ? [...selection.path] : undefined,
			};
			if (!ctx.canvasManager.floatingCanvas) {
				ctx.historyManager.beginTransaction();
				ctx.canvasManager.floatingCanvas = ctx.canvasManager.extractRegion(selection);
				ctx.canvasManager.fillRegion(selection, ctx.canvasManager.backgroundColor);
				ctx.setSelection({ ...selection });
			}
			return;
		}

		ctx.commitFloatingSelection();
		state.moving = false;
		state.originalSelection = null;
		state.start = point;
		ctx.setMarqueeStatus?.(true);
		if (state.mode === SELECTION_MODES.lasso) {
			state.path = [clampPoint(point, ctx.canvasManager)];
			ctx.setSelection(null);
			return;
		}
		state.path = [];
		ctx.setSelection({ x: Math.round(point.x), y: Math.round(point.y), w: 0, h: 0 });
	};

	const onMove = (point, ctx) => {
		if (!state.start) return;
		if (state.moving) {
			const dx = Math.round(point.x - state.start.x);
			const dy = Math.round(point.y - state.start.y);
			const x = state.liftedOrigin.x + dx;
			const y = state.liftedOrigin.y + dy;
			ctx.historyManager.setTransactionChanged?.(Boolean(dx || dy));
			ctx.setSelection({
				x,
				y,
				w: ctx.canvasManager.floatingCanvas.width,
				h: ctx.canvasManager.floatingCanvas.height,
				path: translatePath(state.originalSelection.path, dx, dy),
			});
			return;
		}
		if (state.mode === SELECTION_MODES.lasso) {
			appendLassoPoint(state.path, clampPoint(point, ctx.canvasManager));
			updateLassoPreview(ctx);
			return;
		}

		const x = Math.min(state.start.x, point.x);
		const y = Math.min(state.start.y, point.y);
		const rx = Math.max(0, Math.min(ctx.canvasManager.width, x));
		const ry = Math.max(0, Math.min(ctx.canvasManager.height, y));
		const w = Math.min(Math.abs(point.x - state.start.x), ctx.canvasManager.width - rx);
		const h = Math.min(Math.abs(point.y - state.start.y), ctx.canvasManager.height - ry);
		ctx.setSelection({ x: Math.round(rx), y: Math.round(ry), w: Math.round(w), h: Math.round(h) });
	};

	const onUp = (point, ctx) => {
		ctx.setMarqueeStatus?.(false);
		ctx.repaintSelectionFrame?.();
		if (!state.start) return;
		if (state.moving) {
			state.moving = false;
			state.originalSelection = null;
			ctx.canvasManager.persistToStorage();
		} else if (state.mode === SELECTION_MODES.lasso) {
			cancelPreview();
			appendLassoPoint(state.path, clampPoint(point, ctx.canvasManager));
			const bounds = getPathBounds(state.path);
			ctx.setSelection(bounds ? { ...bounds, path: [...state.path] } : null);
			state.path = [];
		} else {
			const selection = ctx.getSelection();
			if (selection && (!selection.w || !selection.h)) ctx.setSelection(null);
		}
		state.start = null;
		state.liftedOrigin = null;
	};

	const onCancel = (_point, ctx) => {
		cancelPreview();
		if (!state.moving) ctx.setSelection(null);
		ctx.setMarqueeStatus?.(false);
		state.start = null;
		state.moving = false;
		state.liftedOrigin = null;
		state.originalSelection = null;
		state.path = [];
	};

	const setMode = (mode) => {
		if (mode !== SELECTION_MODES.rectangle && mode !== SELECTION_MODES.lasso) {
			throw new RangeError(`Unsupported selection mode: ${mode}`);
		}
		state.mode = mode;
	};

	return {
		name: 'select',
		cursor: 'crosshair',
		onActivate,
		onDeactivate,
		onDown,
		onMove,
		onUp,
		onCancel,
		setMode,
		getMode: () => state.mode,
		_inside: inside,
	};
};
