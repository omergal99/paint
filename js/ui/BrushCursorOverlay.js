const BRUSH_TOOLS = new Set(['pencil', 'brush', 'eraser']);

export const createBrushCursorOverlay = ({
	root,
	surface,
	viewportManager,
	getLineWidth,
	documentRef = globalThis.document,
} = {}) => {
	if (!root || !surface || !viewportManager || !documentRef?.createElement) {
		throw new TypeError('Brush cursor requires a canvas root, surface, and viewport manager');
	}
	const cursor = documentRef.createElement('div');
	cursor.className = 'brush-cursor-overlay';
	cursor.setAttribute('aria-hidden', 'true');
	root.append(cursor);

	let active = false;
	let lastPoint = null;
	const hide = () => {
		cursor.hidden = true;
	};
	const render = () => {
		if (!active || !lastPoint) return hide();
		const size = Math.max(1, Number(getLineWidth?.()) || 1);
		cursor.style.left = `${lastPoint.x}px`;
		cursor.style.top = `${lastPoint.y}px`;
		cursor.style.width = `${size}px`;
		cursor.style.height = `${size}px`;
		cursor.style.setProperty('--brush-cursor-size', `${size}px`);
		cursor.hidden = false;
	};
	const onPointerMove = (event) => {
		const point = viewportManager.clientToImage(event.clientX, event.clientY);
		lastPoint = point;
		render();
	};
	const onPointerLeave = () => {
		lastPoint = null;
		hide();
	};
	surface.addEventListener('pointermove', onPointerMove);
	surface.addEventListener('pointerleave', onPointerLeave);

	return Object.freeze({
		setTool(name) {
			active = BRUSH_TOOLS.has(name);
			if (!active) onPointerLeave();
			else render();
		},
		refresh: render,
		destroy() {
			surface.removeEventListener('pointermove', onPointerMove);
			surface.removeEventListener('pointerleave', onPointerLeave);
			cursor.remove();
		},
	});
};
