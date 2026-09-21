// Full-app split workspace for Step 13. Each pane is an isolated Paint app
// instance, so ribbons, canvas state, sidebar state, and status bars cannot
// leak across documents.

export const SPLIT_VIEW_LIMITS = Object.freeze({ min: 20, max: 80, defaultRatio: 50 });

const clamp = (value) => Math.max(SPLIT_VIEW_LIMITS.min, Math.min(SPLIT_VIEW_LIMITS.max, Number(value) || SPLIT_VIEW_LIMITS.defaultRatio));

export const createSplitViewModel = (state, ratio = SPLIT_VIEW_LIMITS.defaultRatio) => ({
	activePane: state?.activePane || 'primary',
	primaryDocumentId: state?.panes?.primary || null,
	secondaryDocumentId: state?.panes?.secondary || null,
	isSplit: Boolean(state?.panes?.secondary),
	ratio: clamp(ratio),
});

/**
 * Adds a split toggle, pane focus buttons, and a keyboard/pointer divider.
 * The host is opt-in and hidden until setVisible/openSplit is called.
 */
export const createSplitView = ({ root = null, sessionService, onChange } = {}) => {
	let destroyed = false;
	let visible = false;
	let ratio = SPLIT_VIEW_LIMITS.defaultRatio;
	let lastState = sessionService?.getState?.() || { panes: { primary: null, secondary: null } };
	let unsubscribe = () => {};
	let stopDrag = null;
	const emit = () => onChange?.(createSplitViewModel(lastState, ratio));
	const setRatio = (value) => {
		ratio = clamp(value);
		if (root) root.style.setProperty('--workspace-split-ratio', `${ratio}%`);
		const divider = root?.querySelector?.('[data-split-divider]');
		if (divider) divider.setAttribute('aria-valuenow', String(ratio));
		emit();
	};
	const ensureSplit = () => {
		if (destroyed || !sessionService) return;
		const state = sessionService.getState();
		if (state.panes?.secondary) return;
		let nextId = state.tabOrder?.find((id) => id !== state.panes?.primary);
		if (!nextId && typeof sessionService.createDocument === 'function') {
			const created = sessionService.createDocument({ activate: false, metadata: { label: 'Image 2' } });
			nextId = created.ok ? created.document?.id : null;
		}
		if (nextId) sessionService.setPaneDocument('secondary', nextId);
	};
	const toggle = () => {
		if (destroyed || !sessionService) return;
		if (sessionService.getState().panes?.secondary) sessionService.setPaneDocument('secondary', null);
		else ensureSplit();
	};
	const openSplit = () => {
		if (destroyed) return;
		visible = true;
		ensureSplit();
		render(sessionService?.getState?.() || lastState);
	};
	const setVisible = (nextVisible) => {
		if (destroyed) return;
		visible = Boolean(nextVisible);
		render(lastState);
	};
	const focusPane = (pane) => sessionService?.setActivePane?.(pane);
	const assignPane = (pane, id) => {
		if (!sessionService || (pane === 'primary' && !id)) return;
		sessionService.setPaneDocument?.(pane, id || null);
	};
	const render = (state = lastState) => {
		if (destroyed) return;
		lastState = state;
		if (!root?.ownerDocument) {
			emit();
			return;
		}
		root.replaceChildren();
		root.hidden = !visible;
		if (!visible) {
			root.classList.remove('is-expanded', 'is-split');
			emit();
			return;
		}
		root.classList.add('workspace-split-view');
		root.classList.toggle('is-split', Boolean(state.panes?.secondary));
		root.classList.toggle('is-expanded', Boolean(state.panes?.secondary));
		root.dataset.tag ||= 'workspace-split-view';
		root.style.setProperty('--workspace-split-ratio', `${ratio}%`);
		const toolbar = root.ownerDocument.createElement('div');
		toolbar.className = 'workspace-split-toolbar';
		const toggleButton = root.ownerDocument.createElement('button');
		toggleButton.type = 'button';
		toggleButton.className = 'workspace-split-toggle';
		toggleButton.dataset.tag = 'workspace-split-toggle';
		toggleButton.textContent = createSplitViewModel(state, ratio).isSplit ? 'Single view' : 'Split view';
		toggleButton.setAttribute('aria-pressed', String(createSplitViewModel(state, ratio).isSplit));
		toggleButton.addEventListener('click', toggle);
		toolbar.append(toggleButton);
		const closeButton = root.ownerDocument.createElement('button');
		closeButton.type = 'button';
		closeButton.className = 'workspace-split-close';
		closeButton.dataset.tag = 'workspace-split-close';
		closeButton.textContent = 'Close split';
		closeButton.title = 'Close split view';
		closeButton.addEventListener('click', () => {
			sessionService?.setPaneDocument?.('secondary', null);
			setVisible(false);
		});
		toolbar.append(closeButton);
		root.append(toolbar);
		const panes = root.ownerDocument.createElement('div');
		panes.className = 'workspace-split-panes';
		for (const pane of ['primary', 'secondary']) {
			const section = root.ownerDocument.createElement('section');
			section.className = `workspace-pane workspace-pane-${pane}`;
			section.dataset.pane = pane;
			section.dataset.tag = `workspace-pane-${pane}`;
			section.setAttribute('aria-label', `${pane} document`);
			const heading = root.ownerDocument.createElement('div');
			heading.className = 'workspace-pane-heading';
			const label = root.ownerDocument.createElement('span');
			label.className = 'workspace-pane-label';
			label.textContent = pane === 'primary' ? 'Primary document' : 'Secondary document';
			const focus = root.ownerDocument.createElement('button');
			focus.type = 'button';
			focus.className = 'workspace-pane-focus';
			focus.dataset.tag = `workspace-pane-focus-${pane}`;
			focus.textContent = 'Focus';
			focus.title = `Focus ${pane} document`;
			focus.addEventListener('click', () => focusPane(pane));
			heading.append(label, focus);
			const select = root.ownerDocument.createElement('select');
			select.className = 'workspace-pane-select';
			select.dataset.tag = `workspace-pane-select-${pane}`;
			select.setAttribute('aria-label', `Document in ${pane} pane`);
			const documents = Array.isArray(state.tabOrder) ? state.tabOrder : [];
			documents.forEach((id) => {
				const option = root.ownerDocument.createElement('option');
				option.value = id;
				const document = state.documents?.find?.((item) => item.id === id);
				option.textContent = document?.metadata?.label || 'Image';
				option.selected = id === state.panes?.[pane];
				select.append(option);
			});
			if (pane === 'secondary') {
				const none = root.ownerDocument.createElement('option');
				none.value = '';
				none.textContent = 'No document';
				none.selected = !state.panes?.secondary;
				select.prepend(none);
			}
			select.addEventListener('change', () => assignPane(pane, select.value));
			section.append(heading, select);
			if (state.panes?.[pane]) {
				const frame = root.ownerDocument.createElement('iframe');
				frame.className = 'workspace-pane-frame';
				frame.dataset.tag = `workspace-pane-frame-${pane}`;
				frame.title = `${pane === 'primary' ? 'Primary' : 'Secondary'} Paint document`;
				frame.loading = 'eager';
				try {
					const appUrl = new URL('index.html', root.ownerDocument.location.href);
					appUrl.searchParams.set('embedded', '1');
					appUrl.searchParams.set('splitPane', pane);
					appUrl.searchParams.set('documentId', state.panes[pane]);
					frame.src = appUrl.href;
				} catch {
					frame.src = `index.html?embedded=1&splitPane=${encodeURIComponent(pane)}`;
				}
				section.append(frame);
			}
			if (pane === 'secondary' && !state.panes?.secondary) section.hidden = true;
			panes.append(section);
		}
		const divider = root.ownerDocument.createElement('div');
		divider.className = 'workspace-split-divider';
		divider.dataset.splitDivider = 'true';
		divider.dataset.tag = 'workspace-split-divider';
		divider.setAttribute('role', 'separator');
		divider.setAttribute('aria-orientation', 'vertical');
		divider.setAttribute('aria-valuemin', String(SPLIT_VIEW_LIMITS.min));
		divider.setAttribute('aria-valuemax', String(SPLIT_VIEW_LIMITS.max));
		divider.setAttribute('aria-valuenow', String(ratio));
		divider.tabIndex = 0;
		divider.addEventListener('keydown', (event) => {
			if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); setRatio(ratio - 2); }
			if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); setRatio(ratio + 2); }
		});
		divider.addEventListener('pointerdown', (event) => {
			if (!root.clientWidth) return;
			divider.setPointerCapture?.(event.pointerId);
			stopDrag?.();
			const direction = root.ownerDocument.defaultView?.getComputedStyle(root).direction || 'ltr';
			const move = (moveEvent) => {
				const position = (moveEvent.clientX - root.getBoundingClientRect().left) / root.clientWidth * 100;
				setRatio(direction === 'rtl' ? 100 - position : position);
			};
			const stop = () => {
				if (stopDrag !== stop) return;
				root.ownerDocument.removeEventListener('pointermove', move);
				root.ownerDocument.removeEventListener('pointerup', stop);
				root.ownerDocument.removeEventListener('pointercancel', stop);
				divider.releasePointerCapture?.(event.pointerId);
				stopDrag = null;
			};
			stopDrag = stop;
			root.ownerDocument.addEventListener('pointermove', move);
			root.ownerDocument.addEventListener('pointerup', stop, { once: true });
			root.ownerDocument.addEventListener('pointercancel', stop, { once: true });
		});
		panes.append(divider);
		root.append(panes);
		emit();
	};
	if (typeof sessionService?.subscribe === 'function') unsubscribe = sessionService.subscribe((event) => render(event.state));
	render(lastState);
	return Object.freeze({
		render,
		setRatio,
		toggle,
		openSplit,
		setVisible,
		isVisible: () => visible,
		getModel: () => createSplitViewModel(lastState, ratio),
		destroy() { destroyed = true; stopDrag?.(); unsubscribe(); if (root?.replaceChildren) root.replaceChildren(); },
	});
};
