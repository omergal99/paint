const BRUSH_TOOLS = new Set(['pencil', 'brush', 'eraser']);

export const createBrushCursorOverlay = ({
	root,
	surface,
	viewportManager,
	getLineWidth,
	getTipShape = () => 'round',
	// `{ angle, angleJitter }` from BrushState: the base angle always shows on
	// hover so the cursor previews the angle the next stamp will use. Rotation
	// jitter only animates while a stroke is active (pointer down), so idle
	// hovering never wobbles.
	getRotation = () => null,
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
	let activeBrush = false;
	let lastPoint = null;
	let painting = false;
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
		const requestedTipShape = getTipShape?.();
		const tipShape = ['round', 'square', 'diamond', 'soft'].includes(requestedTipShape)
			? requestedTipShape
			: 'round';
		cursor.dataset.tipShape = activeBrush ? tipShape : 'round';
		const rotation = (activeBrush && getRotation?.()) || {};
		const baseAngle = Number.isFinite(Number(rotation.angle)) ? Number(rotation.angle) : 0;
		const jitter = Math.max(0, Math.min(1, Number(rotation.angleJitter) || 0));
		// Hover keeps the settled base angle (the next stamp's angle); only an
		// active stroke rolls the jittered rotation per render.
		const jitterDeg = painting && jitter ? (Math.random() * 2 - 1) * jitter * 180 : 0;
		cursor.style.setProperty('--brush-cursor-rotation', `${Math.round((baseAngle + jitterDeg) * 10) / 10}deg`);
		cursor.hidden = false;
	};
	const onPointerMove = (event) => {
		const point = viewportManager.clientToImage(event.clientX, event.clientY);
		lastPoint = point;
		// Hover (no buttons pressed) keeps the settled base angle; a pressed
		// pointer is an active stroke so jitter animates. Touch only fires
		// pointermove while in contact, so any touch move counts as painting.
		if (event?.pointerType === 'touch') painting = true;
		else if (typeof event?.buttons === 'number') painting = event.buttons !== 0;
		render();
	};
	const onPointerDown = (event) => {
		painting = true;
		if (Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY)) {
			lastPoint = viewportManager.clientToImage(event.clientX, event.clientY);
		}
		render();
	};
	const onPointerUp = () => {
		painting = false;
		render();
	};
	const onPointerLeave = () => {
		lastPoint = null;
		painting = false;
		hide();
	};
	const surfaceTarget = surface;
	// Pointer capture moves pointerup/pointercancel off the surface: also
	// listen on the owner window/document so releasing outside (or an
	// interrupted gesture) clears the painting flag and hover stops wobbling.
	const releaseTarget = documentRef?.defaultView
		|| surfaceTarget?.ownerDocument?.defaultView || null;
	surfaceTarget.addEventListener('pointermove', onPointerMove);
	surfaceTarget.addEventListener('pointerdown', onPointerDown);
	surfaceTarget.addEventListener('pointerup', onPointerUp);
	surfaceTarget.addEventListener('pointercancel', onPointerUp);
	surfaceTarget.addEventListener('pointerleave', onPointerLeave);
	releaseTarget?.addEventListener?.('pointerup', onPointerUp);
	releaseTarget?.addEventListener?.('pointercancel', onPointerUp);
	releaseTarget?.addEventListener?.('blur', onPointerUp);

	return Object.freeze({
		setTool(name) {
			activeBrush = name === 'brush';
			active = BRUSH_TOOLS.has(name);
			if (!active) {
				painting = false;
				onPointerLeave();
			} else render();
		},
		refresh: render,
		setPainting(next) {
			painting = next === true;
			render();
		},
		destroy() {
			surfaceTarget.removeEventListener('pointermove', onPointerMove);
			surfaceTarget.removeEventListener('pointerdown', onPointerDown);
			surfaceTarget.removeEventListener('pointerup', onPointerUp);
			surfaceTarget.removeEventListener('pointercancel', onPointerUp);
			surfaceTarget.removeEventListener('pointerleave', onPointerLeave);
			releaseTarget?.removeEventListener?.('pointerup', onPointerUp);
			releaseTarget?.removeEventListener?.('pointercancel', onPointerUp);
			releaseTarget?.removeEventListener?.('blur', onPointerUp);
			cursor.remove();
		},
	});
};
