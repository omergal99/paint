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
		autoScroll: null, // { raf, axis: 'x'|'y', dir: -1|1, speed }
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

	const isAutoScrollEnabled = () => {
		try { return localStorage.getItem('paint:auto-scroll') === 'true'; } catch { return false; }
	};

	// ---------- Viewport auto-scroll during selection drag ----------
	const AUTO_SCROLL_EDGE = 24;
	const AUTO_SCROLL_SPEED = 12;

	const stopAutoScroll = () => {
		if (state.autoScroll?.raf != null) {
			cancelFrame(state.autoScroll.raf);
		}
		state.autoScroll = null;
	};

	const startAutoScroll = (vp, clientX, clientY) => {
		if (!vp || !isAutoScrollEnabled()) { stopAutoScroll(); return; }
		const rect = vp.getBoundingClientRect();
		let dirX = 0;
		let dirY = 0;

		if (clientX - rect.left < AUTO_SCROLL_EDGE) dirX = -1;
		else if (rect.right - clientX < AUTO_SCROLL_EDGE) dirX = 1;
		if (clientY - rect.top < AUTO_SCROLL_EDGE) dirY = -1;
		else if (rect.bottom - clientY < AUTO_SCROLL_EDGE) dirY = 1;

		if (dirX === 0 && dirY === 0) {
			stopAutoScroll();
			return;
		}

		const scroll = () => {
			if (dirX !== 0) vp.scrollLeft += dirX * AUTO_SCROLL_SPEED;
			if (dirY !== 0) vp.scrollTop += dirY * AUTO_SCROLL_SPEED;
			state.autoScroll.raf = requestFrame(scroll);
		};
		stopAutoScroll();
		state.autoScroll = { raf: null };
		state.autoScroll.raf = requestFrame(scroll);
	};

	const onActivate = (ctx) => {
		state.start = null;
		state.moving = false;
		state.path = [];
		state.originalSelection = null;
		ctx.setMarqueeStatus?.(false);
	};

	const onDeactivate = (ctx) => {
		stopAutoScroll();
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
			const vp = ctx.viewportManager?.viewportEl;
			state.scrollStart = vp ? { left: vp.scrollLeft, top: vp.scrollTop } : { left: 0, top: 0 };
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

		// A press that starts OUTSIDE the current selection is the "draw another
		// shape" gesture when a select-after-draw shape lift is still pending its
		// tool restore. Place the lifted shape and hand the very same gesture to
		// the shape tool, so one press draws a new shape instead of first opening
		// a throwaway marquee (W4-01b: no second click needed).
		if (ctx.canvasManager.floatingCanvas && ctx._deferShapeToolReactivate === true) {
			ctx.commitFloatingSelection();
			const target = (() => {
				const prev = ctx.getPreviousTool?.();
				return (prev === 'select' || prev === 'shape' || !prev) ? 'shape' : prev;
			})();
			state.start = null;
			state.moving = false;
			state.originalSelection = null;
			state.path = [];
			ctx.setMarqueeStatus?.(false);
			ctx.setActiveTool?.(target);
			// Re-dispatch this press to the freshly active shape tool so the drag
			// that is already in flight becomes the new shape's start point.
			const shapeTool = ctx.toolManager?.tools?.get?.(target);
			shapeTool?.onDown?.(point, ctx);
			return;
		}

		ctx.commitFloatingSelection();
		state.moving = false;
		state.originalSelection = null;
		state.start = point;
		// Capture viewport scroll at drag start so auto-scroll during the drag
		// doesn't shift the selection away from the pointer (W4-18).
		const vp = ctx.viewportManager?.viewportEl;
		state.scrollStart = vp ? { left: vp.scrollLeft, top: vp.scrollTop } : { left: 0, top: 0 };
		ctx.setMarqueeStatus?.(true);
		if (state.mode === SELECTION_MODES.lasso) {
			state.path = [clampPoint(point, ctx.canvasManager)];
			ctx.setSelection(null);
			return;
		}
		state.path = [];
		ctx.setSelection({ x: Math.round(point.x), y: Math.round(point.y), w: 0, h: 0 });
	};

	const onMove = (point, ctx, event) => {
		if (!state.start) return;
		if (state.moving) {
			// Compensate for viewport scroll during drag so the selection
			// stays under the pointer when auto-scroll is active (W4-18).
			const vp = ctx.viewportManager?.viewportEl;
			const scrollStart = state.scrollStart || { left: 0, top: 0 };
			const scrollDeltaX = vp ? vp.scrollLeft - scrollStart.left : 0;
			const scrollDeltaY = vp ? vp.scrollTop - scrollStart.top : 0;
			const scale = Math.max(0.01, (ctx.viewportManager?.zoom ?? 100) / 100);
			const dx = Math.round(point.x - state.start.x - scrollDeltaX / scale);
			const dy = Math.round(point.y - state.start.y - scrollDeltaY / scale);
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

			// Auto-scroll when dragging near viewport edge (moving selection)
			if (event && isAutoScrollEnabled()) startAutoScroll(ctx.viewportManager?.viewportEl, event.clientX, event.clientY);
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

		// Auto-scroll when dragging near viewport edge (marquee selection)
		if (event && isAutoScrollEnabled()) startAutoScroll(ctx.viewportManager?.viewportEl, event.clientX, event.clientY);
	};

	const onUp = (point, ctx, event) => {
		stopAutoScroll();
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

	const onCancel = (_point, ctx, event) => {
		stopAutoScroll();
		cancelPreview();
		if (state.moving) {
			// An in-progress move drag was cancelled: restore the original
			// position so the user does not lose the selection's placement.
			if (state.originalSelection) {
				ctx.setSelection(state.originalSelection);
			}
		}
		// When !state.moving (marquee creation): do NOT clear the selection. It
		// was already painted by onMove, and a pointercancel (e.g. macOS dropping
		// pointerup) is not an explicit user cancel. Keep the marquee intact.
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
