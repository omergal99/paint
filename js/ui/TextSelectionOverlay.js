// Keyboard and pointer affordances for committed text-layer objects.
// This layer never creates a pixel selection; it only delegates movement to
// TextLayerService.
import { STORAGE_KEYS } from '../core/constants.js';
import { t } from '../i18n/messages.js';

const TEXT_TARGET_PADDING = 4;
const MIN_TEXT_TARGET_WIDTH = 24;

export const copyTextToClipboard = async ({
	text,
	navigatorRef = globalThis.navigator,
	documentRef = globalThis.document,
} = {}) => {
	const value = String(text || '');
	if (!value) return false;

	try {
		const clipboard = navigatorRef?.clipboard;
		if (typeof clipboard?.writeText === 'function') {
			await clipboard.writeText(value);
			return true;
		}
	} catch {}

	if (!documentRef?.createElement || typeof documentRef.execCommand !== 'function') return false;

	const activeElement = documentRef.activeElement;
	const textarea = documentRef.createElement('textarea');
	textarea.value = value;
	textarea.style.position = 'fixed';
	textarea.style.left = '-9999px';
	textarea.style.opacity = '0';
	documentRef.body?.appendChild(textarea);

	let copied = false;
	try {
		textarea.focus();
		textarea.select();
		copied = documentRef.execCommand('copy') === true;
	} catch {
		copied = false;
	} finally {
		if (typeof textarea.remove === 'function') {
			textarea.remove();
		} else {
			documentRef.body?.removeChild?.(textarea);
		}
		activeElement?.focus?.();
	}
	return copied;
};

const labelFor = (object) => {
	const text = String(object.text || '').replace(/\s+/g, ' ').trim();
	return text ? `Focus text: ${text.slice(0, 60)}` : 'Focus text object';
};

export const createTextSelectionOverlay = ({
	root,
	store,
	getZoom = () => 1,
	getViewportScroll,
	onMoveStart,
	onMove,
	onMoveEnd,
	onDelete,
	onCopyResult,
} = {}) => {
	const layer = document.createElement('div');
	layer.className = 'text-object-focus-layer';
	layer.setAttribute('role', 'group');
	layer.setAttribute('aria-label', 'Committed text objects');
	root?.appendChild(layer);

	let selectedId = null;
	let dragState = null;

	// The focus boxes are an opt-in affordance (W4-11): hidden by default so the
	// committed text never blocks drawing, shown only when the pointer needs to
	// grab or move a box. Visibility is one persisted flag read here (SSOT), so
	// the overlay never depends on the Toolbar being constructed yet.
	const readVisible = () => {
		try { return localStorage.getItem(STORAGE_KEYS.textLayerVisible) === 'true'; } catch { return false; }
	};
		const applyVisibility = (forceVisible = false) => {
		const visible = forceVisible ? true : readVisible();
		layer.classList.toggle('is-hidden', !visible);
		layer.setAttribute('aria-hidden', String(!visible));
	};

	const deleteSelected = () => {
		if (!selectedId) return false;
		const id = selectedId;
		selectedId = null;
		onDelete?.({ id });
		render(store?.getAll?.() || []);
		return true;
	};

	const select = (id, forceVisible = false) => {
		const object = store?.getAll().find((item) => item.id === id);
		if (!object) return null;
		selectedId = id;
		render(store.getAll(), forceVisible);
		layer.dispatchEvent(new CustomEvent('paint:text-object-focus', { detail: object }));
		return object;
	};

	const render = (objects = [], forceVisible = false) => {
		if (dragState) return;
		applyVisibility(forceVisible);
		layer.replaceChildren();
		objects.forEach((object) => {
			const target = document.createElement('div');
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

			// W4-13: Copy text box content to clipboard
			const copyBtn = document.createElement('button');
copyBtn.type = 'button';

			copyBtn.className = 'text-object-copy-btn';

			copyBtn.setAttribute('aria-label', t('ui.textCopy'));
			copyBtn.title = t('ui.textCopy');
			copyBtn.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="9" height="9" rx="1"/><rect x="4" y="4" width="9" height="9" rx="1"/></svg>';
			const copyText = async () => {
				const text = String(object.text || '');
				if (!text) return;
				const copied = await copyTextToClipboard({ text });
				onCopyResult?.({ copied });
			};
			copyBtn.addEventListener('click', (event) => {
				event.preventDefault();
				event.stopPropagation();
				copyText();
			});
			copyBtn.addEventListener('keydown', (event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					event.stopPropagation();
					copyText();
				}
			});
			target.appendChild(copyBtn);

			target.addEventListener('pointerdown', (event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				event.stopPropagation();
				const vp = getViewportScroll ? getViewportScroll() : null;
				dragState = {
					id: object.id,
					pointerId: event.pointerId,
					clientX: event.clientX,
					clientY: event.clientY,
					lastScrollLeft: vp ? vp.left : 0,
					lastScrollTop: vp ? vp.top : 0,
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
				const vp = getViewportScroll ? getViewportScroll() : null;
				const scrollDeltaX = vp ? vp.left - dragState.lastScrollLeft : 0;
				const scrollDeltaY = vp ? vp.top - dragState.lastScrollTop : 0;
				const dx = (event.clientX - dragState.clientX + scrollDeltaX) / zoom;
				const dy = (event.clientY - dragState.clientY + scrollDeltaY) / zoom;
				if (dx || dy) dragState.moved = true;
				dragState.clientX = event.clientX;
				dragState.clientY = event.clientY;
				dragState.lastScrollLeft = vp ? vp.left : 0;
				dragState.lastScrollTop = vp ? vp.top : 0;
				onMove?.({ id: dragState.id, dx, dy, _clientX: event.clientX, _clientY: event.clientY });
			});

			const finishMove = (event) => {
				if (!dragState || dragState.pointerId !== event.pointerId) return;
				target.releasePointerCapture?.(event.pointerId);
				const finished = dragState;
				dragState = null;
				onMoveEnd?.({ id: finished.id, moved: finished.moved });
				render(store?.getAll?.() || [], selectedId !== null);
			};
			target.addEventListener('pointerup', finishMove);
			target.addEventListener('pointercancel', finishMove);

			target.addEventListener('keydown', (event) => {
				if (event.key === 'Delete' && object.id === selectedId) {
					event.preventDefault();
					event.stopPropagation();
					deleteSelected();
					return;
				}
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
	// A settings toggle can flip visibility between renders, so listen too.
	const onVisibilityChange = () => applyVisibility(false);
	if (typeof window !== 'undefined') {
		window.addEventListener('paint:text-layer-visibility-change', onVisibilityChange);
	}

	return Object.freeze({
		element: layer,
		select,
		deleteSelected,
		clear() {
			selectedId = null;
			dragState = null;
			render(store?.getAll?.() || []);
		},
		getSelectedId: () => selectedId,
		destroy() {
			unsubscribe();
			if (typeof window !== 'undefined') {
				window.removeEventListener('paint:text-layer-visibility-change', onVisibilityChange);
			}
			layer.remove();
		},
	});
};
