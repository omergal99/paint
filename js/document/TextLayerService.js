import { renderTextObject } from './TextLayerRenderer.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Owns committed text pixels separately from the paint raster. Moving text
// therefore cannot accidentally enter the pixel selection/erase path.
export const createTextLayerService = ({
	root,
	store,
	canvasManager,
	onMoveStart,
	onMoveEnd,
} = {}) => {
	const canvas = root?.querySelector('#text-layer-canvas') || document.createElement('canvas');
	canvas.id = 'text-layer-canvas';
	canvas.className = 'text-layer-canvas';
	canvas.setAttribute('aria-hidden', 'true');
	if (!canvas.parentNode) {
		const overlayCanvas = root?.querySelector('#overlay-canvas');
		root?.insertBefore(canvas, overlayCanvas || null);
	}

	const hasContent = () => (store?.getAll?.().length || 0) > 0;
	const renderAll = (objects = store?.getAll?.() || []) => {
		const context = canvas.getContext('2d');
		if (!context) return;
		context.clearRect(0, 0, canvas.width, canvas.height);
		objects.forEach((object) => renderTextObject({ context, object }));
	};
	const resize = ({ width = canvasManager?.width, height = canvasManager?.height } = {}) => {
		const nextWidth = Math.max(1, Math.round(Number(width) || 1));
		const nextHeight = Math.max(1, Math.round(Number(height) || 1));
		if (canvas.width !== nextWidth) canvas.width = nextWidth;
		if (canvas.height !== nextHeight) canvas.height = nextHeight;
		renderAll();
	};
	const getObject = (id) => store?.getAll?.().find((object) => object.id === id) || null;
	const beginMove = ({ id } = {}) => {
		if (!getObject(id)) return false;
		onMoveStart?.({ id });
		return true;
	};
	const move = ({ id, dx = 0, dy = 0 } = {}) => {
		const object = getObject(id);
		if (!object) return false;
		const maxX = Math.max(0, (canvasManager?.width || canvas.width) - object.width);
		const maxY = Math.max(0, (canvasManager?.height || canvas.height) - object.height);
		store.update(id, {
			x: clamp(object.x + Number(dx || 0), 0, maxX),
			y: clamp(object.y + Number(dy || 0), 0, maxY),
		});
		return true;
	};
	const endMove = ({ id } = {}) => {
		if (!getObject(id)) return false;
		onMoveEnd?.({ id });
		return true;
	};
	const clear = () => store?.replace?.([]);
	const unsubscribe = store?.subscribe?.(renderAll) || (() => {});

	resize();
	return Object.freeze({
		canvas,
		resize,
		renderAll,
		compositeTo(context) {
			if (!context || !canvas.width || !canvas.height || !hasContent()) return false;
			context.save();
			context.globalAlpha = 1;
			context.globalCompositeOperation = 'source-over';
			context.drawImage(canvas, 0, 0);
			context.restore();
			return true;
		},
		beginMove,
		move,
		endMove,
		hasContent,
		clear,
		destroy() {
			unsubscribe();
			canvas.remove();
		},
	});
};
