// Keyboard and pointer affordances for committed text-layer objects.
// This layer never creates a pixel selection; it only delegates movement to
// TextLayerService.

const TEXT_TARGET_PADDING = 4;
const MIN_TEXT_TARGET_WIDTH = 24;

const labelFor = (object) => {
	const text = String(object.text || '').replace(/\s+/g, ' ').trim();
	return text ? `Focus text: ${text.slice(0, 60)}` : 'Focus text object';
};

export const createTextSelectionOverlay = ({
	root,
	store,
	getZoom = () => 1,
	onMoveStart,
	onMove,
	onMoveEnd,
} = {}) => {
	const layer = document.createElement('div');
	layer.className = 'text-object-focus-layer';
	layer.setAttribute('role', 'group');
	layer.setAttribute('aria-label', 'Committed text objects');
	root?.appendChild(layer);

	let selectedId = null;
	let dragState = null;

	const select = (id) => {
		const object = store?.getAll().find((item) => item.id === id);
		if (!object) return null;
		selectedId = id;
		render(store.getAll());
		layer.dispatchEvent(new CustomEvent('paint:text-object-focus', { detail: object }));
		return object;
	};

	const render = (objects = []) => {
		if (dragState) return;
		layer.replaceChildren();
		objects.forEach((object) => {
			const target = document.createElement('button');
			target.type = 'button';
			target.className = 'text-object-focus-target';
			target.dataset.textObjectId = object.id;
			target.setAttribute('aria-label', labelFor(object));
			target.title = object.id === selectedId
				? 'Selected text. Drag to move.'
				: 'Select text object. Drag to move.';
			target.classList.toggle('selected', object.id === selectedId);
			target.setAttribute('aria-pressed', String(object.id === selectedId));
			target.style.left = `${Math.max(0, object.x - TEXT_TARGET_PADDING)}px`;
			target.style.top = `${Math.max(0, object.y - TEXT_TARGET_PADDING)}px`;
			target.style.width = `${Math.max(MIN_TEXT_TARGET_WIDTH, object.width + TEXT_TARGET_PADDING * 2)}px`;
			target.style.height = `${Math.max(24, object.height + TEXT_TARGET_PADDING * 2)}px`;

			target.addEventListener('pointerdown', (event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				event.stopPropagation();
				dragState = {
					id: object.id,
					pointerId: event.pointerId,
					clientX: event.clientX,
					clientY: event.clientY,
					moved: false,
				};
				select(object.id);
				target.classList.add('selected');
				target.setAttribute('aria-pressed', 'true');
				onMoveStart?.({ id: object.id });
				target.focus({ preventScroll: true });
				target.setPointerCapture?.(event.pointerId);
			});

			target.addEventListener('pointermove', (event) => {
				if (!dragState || dragState.pointerId !== event.pointerId) return;
				const zoom = Math.max(0.01, Number(getZoom()) || 1);
				const dx = (event.clientX - dragState.clientX) / zoom;
				const dy = (event.clientY - dragState.clientY) / zoom;
				if (dx || dy) dragState.moved = true;
				dragState.clientX = event.clientX;
				dragState.clientY = event.clientY;
				onMove?.({ id: dragState.id, dx, dy });
			});

			const finishMove = (event) => {
				if (!dragState || dragState.pointerId !== event.pointerId) return;
				target.releasePointerCapture?.(event.pointerId);
				const finished = dragState;
				dragState = null;
				onMoveEnd?.({ id: finished.id, moved: finished.moved });
				render(store?.getAll?.() || []);
			};
			target.addEventListener('pointerup', finishMove);
			target.addEventListener('pointercancel', finishMove);

			target.addEventListener('keydown', (event) => {
				const deltas = {
					ArrowLeft: [-1, 0],
					ArrowRight: [1, 0],
					ArrowUp: [0, -1],
					ArrowDown: [0, 1],
				};
				const delta = deltas[event.key];
				if (!delta) return;
				event.preventDefault();
				event.stopPropagation();
				select(object.id);
				onMoveStart?.({ id: object.id });
				onMove?.({
					id: object.id,
					dx: delta[0] * (event.shiftKey ? 10 : 1),
					dy: delta[1] * (event.shiftKey ? 10 : 1),
				});
				onMoveEnd?.({ id: object.id, moved: true });
			});

			target.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				select(object.id);
			});
			layer.appendChild(target);
		});
	};

	const unsubscribe = store?.subscribe(render) || (() => {});
	render(store?.getAll?.() || []);

	return Object.freeze({
		element: layer,
		select,
		clear() {
			selectedId = null;
			dragState = null;
			render(store?.getAll?.() || []);
		},
		getSelectedId: () => selectedId,
		destroy() {
			unsubscribe();
			layer.remove();
		},
	});
};
