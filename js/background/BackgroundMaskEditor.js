// Small, provider-neutral rectangle mask editor used by the removal dialog.
// Coordinates are normalized so a future model provider can consume the same
// mask without depending on DOM pixels or the preview's current zoom.

const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const rounded = (value) => Number(value.toFixed(4));
const normalizeRect = (start, end) => {
	const x1 = clamp(Math.min(start.x, end.x));
	const y1 = clamp(Math.min(start.y, end.y));
	const x2 = clamp(Math.max(start.x, end.x));
	const y2 = clamp(Math.max(start.y, end.y));
	return Object.freeze({ x: rounded(x1), y: rounded(y1), w: rounded(x2 - x1), h: rounded(y2 - y1) });
};

export const createBackgroundMaskEditor = ({ root = null, overlay = null, onChange } = {}) => {
	let tool = 'keep';
	let regions = { keep: [], remove: [] };
	let active = null;
	let destroyed = false;

	const emit = () => onChange?.(getRegions());
	const render = () => {
		if (!overlay?.ownerDocument) return;
		overlay.replaceChildren();
		for (const [kind, items] of Object.entries(regions)) {
			items.forEach((region, index) => {
				const element = overlay.ownerDocument.createElement('div');
				element.className = `background-mask-region background-mask-${kind}`;
				element.dataset.tag = `background-mask-${kind}-${index + 1}`;
				element.style.left = `${region.x * 100}%`;
				element.style.top = `${region.y * 100}%`;
				element.style.width = `${region.w * 100}%`;
				element.style.height = `${region.h * 100}%`;
				element.setAttribute('aria-label', `${kind} area ${index + 1}`);
				overlay.append(element);
			});
		}
	};
	const point = (event) => {
		const bounds = root?.getBoundingClientRect?.();
		if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
		return {
			x: clamp((event.clientX - bounds.left) / bounds.width),
			y: clamp((event.clientY - bounds.top) / bounds.height),
		};
	};
	const onPointerDown = (event) => {
		if (destroyed || event.button !== 0) return;
		const start = point(event);
		if (!start) return;
		event.preventDefault();
		event.stopPropagation();
		active = { pointerId: event.pointerId, start };
		root.setPointerCapture?.(event.pointerId);
	};
	const onPointerUp = (event) => {
		if (!active || event.pointerId !== active.pointerId) return;
		event.preventDefault();
		event.stopPropagation();
		const end = point(event);
		if (end) {
			const region = normalizeRect(active.start, end);
			if (region.w >= 0.01 && region.h >= 0.01) {
				regions = { ...regions, [tool]: [...regions[tool], region] };
				render();
				emit();
			}
		}
		root.releasePointerCapture?.(event.pointerId);
		active = null;
	};
	const onPointerMove = (event) => {
		if (!active || event.pointerId !== active.pointerId) return;
		event.preventDefault();
		event.stopPropagation();
	};
	const onDragStart = (event) => { event.preventDefault(); event.stopPropagation(); };
	const setTool = (next) => {
		if (next === 'keep' || next === 'remove') tool = next;
		root?.dataset && (root.dataset.maskTool = tool);
	};
	const clear = () => {
		regions = { keep: [], remove: [] };
		render();
		emit();
	};
	const getRegions = () => Object.freeze({
		keepRegions: Object.freeze([...regions.keep]),
		removeRegions: Object.freeze([...regions.remove]),
	});

	root?.addEventListener?.('pointerdown', onPointerDown);
	root?.addEventListener?.('pointermove', onPointerMove);
	root?.addEventListener?.('pointerup', onPointerUp);
	root?.addEventListener?.('pointercancel', onPointerUp);
	root?.addEventListener?.('dragstart', onDragStart);
	setTool('keep');
	render();
	return Object.freeze({
		setTool,
		clear,
		getRegions,
		destroy() {
			if (destroyed) return;
			destroyed = true;
			root?.removeEventListener?.('pointerdown', onPointerDown);
			root?.removeEventListener?.('pointermove', onPointerMove);
			root?.removeEventListener?.('pointerup', onPointerUp);
			root?.removeEventListener?.('pointercancel', onPointerUp);
			root?.removeEventListener?.('dragstart', onDragStart);
			overlay?.replaceChildren?.();
		},
	});
};
