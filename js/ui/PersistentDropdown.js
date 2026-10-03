const getEnabledOptions = (select) => [...select.options].filter((option) => !option.disabled);

export const createPersistentDropdown = ({
	select,
	documentRef = globalThis.document,
	labelledBy,
} = {}) => {
	if (!select || !documentRef?.createElement) {
		throw new TypeError('Persistent dropdown requires a select element and document');
	}

	const id = select.id;
	const name = select.name;
	const original = {
		id,
		className: select.className,
		title: select.title,
		ariaLabel: select.getAttribute('aria-label'),
		ariaLabelledBy: select.getAttribute('aria-labelledby'),
		tabIndex: select.getAttribute('tabindex'),
		dataTag: select.dataset?.tag,
	};
	const wrapper = documentRef.createElement('div');
	wrapper.className = `persistent-dropdown ${select.className || ''}`.trim();
	if (id) wrapper.id = id;
	if (name) wrapper.setAttribute('name', name);
	if (select.dataset?.tag) {
		wrapper.dataset.tag = select.dataset.tag;
		delete select.dataset.tag;
	}

	const trigger = documentRef.createElement('button');
	trigger.type = 'button';
	trigger.className = 'persistent-dropdown-trigger';
	trigger.setAttribute('role', 'combobox');
	trigger.setAttribute('aria-haspopup', 'listbox');
	trigger.setAttribute('aria-expanded', 'false');
	trigger.setAttribute('data-i18n-ignore', '');
	if (labelledBy || select.getAttribute('aria-labelledby')) {
		trigger.setAttribute('aria-labelledby', labelledBy || select.getAttribute('aria-labelledby'));
	} else if (select.getAttribute('aria-label')) {
		trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
	}
	trigger.title = select.title || '';

	const listbox = documentRef.createElement('div');
	listbox.className = 'persistent-dropdown-options';
	listbox.setAttribute('role', 'listbox');
	listbox.hidden = true;
	if (id) listbox.id = `${id}-options`;
	trigger.setAttribute('aria-controls', listbox.id);

	const nativeId = id ? `${id}-native` : '';
	select.id = nativeId;
	select.classList?.add('persistent-dropdown-source');
	select.tabIndex = -1;
	select.setAttribute('aria-hidden', 'true');
	select.removeAttribute('aria-labelledby');
	select.removeAttribute('aria-label');

	const parent = select.parentNode;
	if (parent) parent.replaceChild(wrapper, select);
	wrapper.append(trigger, listbox, select);

	let activeIndex = -1;
	let isOpen = false;
	let destroyed = false;

	const updateActive = (index) => {
		const enabled = getEnabledOptions(select);
		if (!enabled.length) {
			activeIndex = -1;
			trigger.removeAttribute('aria-activedescendant');
			return;
		}
		activeIndex = Math.max(0, Math.min(enabled.length - 1, index));
		const active = enabled[activeIndex];
		const activeItem = listbox.children[[...select.options].indexOf(active)];
		trigger.setAttribute('aria-activedescendant', activeItem.id);
		[...listbox.children].forEach((option) => {
			option.classList.toggle('is-active', option === activeItem);
		});
		active.scrollIntoView?.({ block: 'nearest' });
	};

	const selectValue = (value, { dispatch = true } = {}) => {
		select.value = value;
		refresh();
		if (dispatch) {
			const EventConstructor = documentRef.defaultView?.Event || globalThis.Event;
			select.dispatchEvent(new EventConstructor('change', { bubbles: true }));
		}
		close({ restoreFocus: true });
	};

	const open = () => {
		if (trigger.disabled) return;
		isOpen = true;
		listbox.hidden = false;
		trigger.setAttribute('aria-expanded', 'true');
		const selectedIndex = getEnabledOptions(select).findIndex((option) => option.value === select.value);
		updateActive(selectedIndex >= 0 ? selectedIndex : 0);
	};

	const close = ({ restoreFocus = false } = {}) => {
		isOpen = false;
		listbox.hidden = true;
		trigger.setAttribute('aria-expanded', 'false');
		trigger.removeAttribute('aria-activedescendant');
		if (restoreFocus) trigger.focus();
	};

	const refresh = () => {
		const selected = [...select.options].find((option) => option.value === select.value);
		trigger.textContent = selected?.textContent || '';
		trigger.title = selected?.title || select.title || selected?.textContent || '';
		trigger.disabled = select.disabled;
		listbox.replaceChildren();
		[...select.options].forEach((option, index) => {
			const item = documentRef.createElement('button');
			item.type = 'button';
			item.id = `${id || 'dropdown'}-option-${index}`;
			item.className = 'persistent-dropdown-option';
			item.setAttribute('role', 'option');
			item.setAttribute('aria-selected', String(option.value === select.value));
			item.setAttribute('aria-disabled', String(option.disabled));
			item.setAttribute('data-i18n-ignore', '');
			item.dataset.value = option.value;
			item.disabled = option.disabled;
			item.textContent = option.textContent;
			item.title = option.title || option.textContent;
			item.addEventListener('click', () => selectValue(option.value));
			listbox.append(item);
		});
		if (isOpen) {
			listbox.hidden = false;
			trigger.setAttribute('aria-expanded', 'true');
			const selectedIndex = getEnabledOptions(select).findIndex((option) => option.value === select.value);
			updateActive(selectedIndex >= 0 ? selectedIndex : 0);
		}
	};

	const moveActive = (direction) => {
		const enabled = getEnabledOptions(select);
		if (!enabled.length) return;
		const nextIndex = activeIndex < 0 ? 0 : (activeIndex + direction + enabled.length) % enabled.length;
		updateActive(nextIndex);
	};

	const onTriggerClick = () => isOpen ? close() : open();
	const onKeyDown = (event) => {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (!isOpen) open();
			else moveActive(event.key === 'ArrowDown' ? 1 : -1);
			return;
		}
		if (event.key === 'Home' || event.key === 'End') {
			if (!isOpen) return;
			event.preventDefault();
			updateActive(event.key === 'Home' ? 0 : getEnabledOptions(select).length - 1);
			return;
		}
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (!isOpen) open();
			else if (activeIndex >= 0) selectValue(getEnabledOptions(select)[activeIndex].value);
			return;
		}
		if (event.key === 'Escape' && isOpen) {
			event.preventDefault();
			close({ restoreFocus: true });
		}
	};
	const onSourceChange = () => refresh();
	const onLocaleChange = () => refresh();
	trigger.addEventListener('click', onTriggerClick);
	trigger.addEventListener('keydown', onKeyDown);
	select.addEventListener('change', onSourceChange);
	documentRef.documentElement?.addEventListener('paint:locale-change', onLocaleChange);
	refresh();

	const api = {
		element: wrapper,
		trigger,
		listbox,
		source: select,
		get value() { return select.value; },
		set value(value) { selectValue(value, { dispatch: false }); },
		get options() { return select.options; },
		get disabled() { return select.disabled; },
		set disabled(value) { select.disabled = Boolean(value); refresh(); },
		get title() { return trigger.title; },
		set title(value) { trigger.title = value; select.title = value; },
		addEventListener: (...args) => select.addEventListener(...args),
		removeEventListener: (...args) => select.removeEventListener(...args),
		focus: () => trigger.focus(),
		refresh,
		setValue: selectValue,
		close,
		destroy() {
			if (destroyed) return;
			destroyed = true;
			trigger.removeEventListener('click', onTriggerClick);
			trigger.removeEventListener('keydown', onKeyDown);
			select.removeEventListener('change', onSourceChange);
			documentRef.documentElement?.removeEventListener('paint:locale-change', onLocaleChange);
			if (parent) {
				wrapper.replaceWith(select);
				select.id = original.id;
				select.className = original.className;
				select.title = original.title;
				select.removeAttribute('aria-hidden');
				if (original.ariaLabel === null) select.removeAttribute('aria-label');
				else select.setAttribute('aria-label', original.ariaLabel);
				if (original.ariaLabelledBy === null) select.removeAttribute('aria-labelledby');
				else select.setAttribute('aria-labelledby', original.ariaLabelledBy);
				if (original.tabIndex === null) select.removeAttribute('tabindex');
				else select.setAttribute('tabindex', original.tabIndex);
				if (original.dataTag) select.dataset.tag = original.dataTag;
				wrapper.remove();
			} else {
				wrapper.remove();
			}
		},
	};
	return Object.freeze(api);
};
