// Reusable workspace tab bar for the Step 13 session contract.
//
// The tab bar owns presentation and keyboard behavior only. SessionService
// remains the source of truth for ordering, active document, and dirty state.
// Keeping this seam independent of CanvasManager lets the editor migrate one
// document at a time without coupling tab lifetime to canvas lifetime.

export const TABBAR_KEYS = Object.freeze({
	previous: 'ArrowLeft',
	next: 'ArrowRight',
	first: 'Home',
	last: 'End',
	close: 'Delete',
});

const safeLabel = (document, index) => {
	const label = document?.metadata?.label || document?.metadata?.name;
	return String(label || `Image ${index + 1}`).trim() || `Image ${index + 1}`;
};

export const createTabBarModel = (state) => {
	const documents = Array.isArray(state?.documents) ? state.documents : [];
	return documents.map((document, index) => ({
		id: document.id,
		label: safeLabel(document, index),
		 dirty: Boolean(document.dirty),
		active: document.id === state?.activeDocumentId,
		index,
	}));
};

const focusTab = (root, index) => {
	const tabs = [...(root?.querySelectorAll?.('[role="tab"]') || [])];
	const tab = tabs[index];
	if (!tab) return;
	tab.focus();
};

/**
 * Mount an accessible tab strip. The supplied `root` is optional so the same
 * controller can be used as a state adapter before the main UI is migrated.
 */
export const createTabBar = ({ root = null, sessionService, onSelect, onClose, onNew, onManage } = {}) => {
	let destroyed = false;
	let unsubscribe = () => {};
	let lastState = sessionService?.getState?.() || { documents: [], tabOrder: [] };

	const select = (id) => {
		if (destroyed || !id) return;
		const result = sessionService?.setActiveDocument?.(id);
		if (result?.ok === false) return;
		onSelect?.(id, result?.state || sessionService?.getState?.());
	};
	const close = (id) => {
		if (destroyed || !id) return;
		const result = sessionService?.closeDocument?.(id);
		if (result?.ok === false) return;
		onClose?.(id, result?.state || sessionService?.getState?.());
	};

	const handleRootClick = (event) => {
		const action = event.target?.closest?.('[data-tab-action]');
		if (!action || !root.contains(action)) return;
		const id = action.dataset.documentId;
		switch (action.dataset.tabAction) {
			case 'select':
				select(id);
				break;
			case 'close':
				event.stopPropagation();
				close(id);
				break;
			case 'new':
				onNew?.();
				break;
			case 'manage':
				onManage?.();
				break;
			default:
				break;
		}
	};

	const handleRootKeydown = (event) => {
		const button = event.target?.closest?.('[data-tab-action="select"]');
		if (!button || !root.contains(button)) return;
		const models = createTabBarModel(lastState);
		const current = models.findIndex((item) => item.id === button.dataset.documentId);
		if (current < 0) return;
		if (event.key === TABBAR_KEYS.close) {
			event.preventDefault();
			close(models[current].id);
			return;
		}
		const next = event.key === TABBAR_KEYS.previous ? current - 1
			: event.key === TABBAR_KEYS.next ? current + 1
			: event.key === TABBAR_KEYS.first ? 0
			: event.key === TABBAR_KEYS.last ? models.length - 1 : -1;
		if (next < 0 || next >= models.length) return;
		event.preventDefault();
		select(models[next].id);
		focusTab(root, next);
	};

	const render = (state = lastState) => {
		if (destroyed) return;
		lastState = state;
		if (!root?.ownerDocument) return;
		root.replaceChildren();
		root.setAttribute('role', 'tablist');
		root.setAttribute('aria-label', root.getAttribute('aria-label') || 'Open images');
		root.dataset.tag ||= 'workspace-tab-bar';
		createTabBarModel(state).forEach((model) => {
			const tab = root.ownerDocument.createElement('div');
			tab.className = 'workspace-tab';
			if (model.active) tab.classList.add('is-active');
			tab.dataset.documentId = model.id;
			tab.dataset.tag = 'workspace-tab';
			const button = root.ownerDocument.createElement('button');
			button.type = 'button';
			button.className = 'workspace-tab-select';
			button.dataset.tag = 'workspace-tab-select';
			button.setAttribute('role', 'tab');
			button.setAttribute('aria-selected', String(model.active));
			button.tabIndex = model.active ? 0 : -1;
			button.id = `workspace-tab-${model.id}`;
			button.textContent = `${model.label}${model.dirty ? ' •' : ''}`;
			button.title = model.dirty ? `${model.label} (unsaved)` : model.label;
			button.setAttribute('aria-label', button.title);
			button.dataset.tabAction = 'select';
			button.dataset.documentId = model.id;
			const closeButton = root.ownerDocument.createElement('button');
			closeButton.type = 'button';
			closeButton.className = 'workspace-tab-close';
			closeButton.dataset.tag = 'workspace-tab-close';
			closeButton.dataset.tabAction = 'close';
			closeButton.dataset.documentId = model.id;
			closeButton.setAttribute('aria-label', `Close ${model.label}`);
			closeButton.textContent = '×';
			tab.append(button, closeButton);
			root.append(tab);
		});
		const add = root.ownerDocument.createElement('button');
		add.type = 'button';
		add.className = 'workspace-tab-new';
		add.dataset.tag = 'workspace-tab-new';
		add.dataset.tabAction = 'new';
		add.setAttribute('aria-label', 'New image');
		add.title = 'New image';
		add.textContent = '+';
		root.append(add);
		if (onManage) {
			const manage = root.ownerDocument.createElement('button');
			manage.type = 'button';
			manage.className = 'workspace-tab-manage';
			manage.dataset.tag = 'workspace-tab-manage';
			manage.dataset.tabAction = 'manage';
			manage.setAttribute('aria-label', 'Manage open images');
			manage.title = 'Manage open images';
			manage.textContent = '⋯';
			root.append(manage);
		}
	};

	root?.addEventListener?.('click', handleRootClick);
	root?.addEventListener?.('keydown', handleRootKeydown);
	if (typeof sessionService?.subscribe === 'function') unsubscribe = sessionService.subscribe((event) => render(event.state));
	render(lastState);
	return Object.freeze({
		render,
		getModel: () => createTabBarModel(lastState),
		destroy() {
			if (destroyed) return;
			destroyed = true;
			unsubscribe();
			root?.removeEventListener?.('click', handleRootClick);
			root?.removeEventListener?.('keydown', handleRootKeydown);
			if (root?.replaceChildren) root.replaceChildren();
		},
	});
};
