import { DEFAULT_TEXT_FONT_FAMILY } from '../core/constants.js';
import { t } from '../i18n/messages.js';
import { closePersistentDropdowns } from './PersistentDropdown.js';

const renderOptionLabel = (family) => family.value === DEFAULT_TEXT_FONT_FAMILY
	? t('ui.systemUiDefaultFont')
	: family.label;

export const createFontFamilyPicker = ({
	root,
	families,
	value,
	onChange,
	eventTarget = globalThis.document?.documentElement,
} = {}) => {
	if (!root || !Array.isArray(families)) {
		throw new TypeError('FontFamilyPicker requires a root element and font families');
	}

	const listboxId = `${root.id || 'text-font-family'}-options`;
	const trigger = document.createElement('button');
	trigger.type = 'button';
	trigger.className = 'font-family-picker-trigger';
	trigger.setAttribute('aria-haspopup', 'listbox');
	trigger.setAttribute('aria-controls', listboxId);
	trigger.setAttribute('aria-expanded', 'false');
	trigger.setAttribute('aria-label', t('ui.textFontFamily'));

	const listbox = document.createElement('div');
	listbox.id = listboxId;
	listbox.className = 'font-family-picker-listbox';
	listbox.setAttribute('role', 'listbox');
	listbox.setAttribute('aria-label', t('ui.textFontFamily'));
	listbox.hidden = true;

	const options = families.map((family, index) => {
		const option = document.createElement('div');
		option.id = `${listboxId}-option-${index}`;
		option.className = 'font-family-picker-option';
		option.dataset.fontValue = family.value;
		option.setAttribute('role', 'option');
		option.tabIndex = -1;
		const preview = document.createElement('span');
		preview.className = 'font-family-picker-preview';
		preview.textContent = 'Aa';
		preview.setAttribute('aria-hidden', 'true');
		preview.style.fontFamily = family.value;
		const label = document.createElement('span');
		label.className = 'font-family-picker-label';
		label.textContent = renderOptionLabel(family);
		option.append(preview, label);
		listbox.appendChild(option);
		return { element: option, preview, label, family };
	});

	let currentValue = value;
	let activeIndex = Math.max(0, families.findIndex((family) => family.value === currentValue));
	let isOpen = false;

	const updateOptions = () => {
		const selectedIndex = families.findIndex((family) => family.value === currentValue);
		options.forEach(({ element }, index) => {
			const selected = index === selectedIndex;
			element.setAttribute('aria-selected', String(selected));
			element.classList.toggle('is-selected', selected);
		});
		activeIndex = Math.max(0, selectedIndex);
		trigger.setAttribute('aria-activedescendant', options[activeIndex]?.element.id || '');
		const family = families[selectedIndex] || families[0];
		trigger.replaceChildren();
		const preview = document.createElement('span');
		preview.className = 'font-family-picker-preview';
		preview.textContent = 'Aa';
		preview.setAttribute('aria-hidden', 'true');
		preview.style.fontFamily = family.value;
		const label = document.createElement('span');
		label.className = 'font-family-picker-label';
		label.textContent = renderOptionLabel(family);
		const indicator = document.createElement('span');
		indicator.className = 'font-family-picker-indicator';
		indicator.setAttribute('aria-hidden', 'true');
		indicator.textContent = '▾';
		trigger.append(preview, label, indicator);
		trigger.title = renderOptionLabel(family);
	};

	const setActiveIndex = (index) => {
		activeIndex = (index + options.length) % options.length;
		trigger.setAttribute('aria-activedescendant', options[activeIndex].element.id);
		options[activeIndex].element.scrollIntoView?.({ block: 'nearest' });
	};

	const close = ({ returnFocus = false } = {}) => {
		isOpen = false;
		listbox.hidden = true;
		trigger.setAttribute('aria-expanded', 'false');
		if (returnFocus) trigger.focus();
	};

	const open = () => {
		closePersistentDropdowns();
		isOpen = true;
		listbox.hidden = false;
		trigger.setAttribute('aria-expanded', 'true');
		const selectedIndex = families.findIndex((family) => family.value === currentValue);
		setActiveIndex(Math.max(0, selectedIndex));
	};

	const selectFamily = (nextValue) => {
		if (!families.some((family) => family.value === nextValue) || nextValue === currentValue) return;
		currentValue = nextValue;
		updateOptions();
		onChange?.(nextValue);
	};

	const getOptionFromEvent = (event) => {
		const option = event.target?.closest?.('.font-family-picker-option');
		return option && listbox.contains(option) ? option : null;
	};

	const handleOptionPointerdown = (event) => {
		if (getOptionFromEvent(event)) event.preventDefault();
	};

	const handleOptionClick = (event) => {
		const option = getOptionFromEvent(event);
		if (!option) return;
		event.stopPropagation();
		selectFamily(option.dataset.fontValue);
		close({ returnFocus: true });
	};

	const handleTriggerClick = (event) => {
		event.stopPropagation();
		if (isOpen) close();
		else open();
	};

	const handleTriggerKeydown = (event) => {
		if (event.code === 'Escape' && isOpen) {
			event.preventDefault();
			event.stopPropagation();
			close({ returnFocus: true });
		} else if (event.code === 'ArrowDown' || event.code === 'ArrowUp') {
			event.preventDefault();
			if (!isOpen) open();
			else setActiveIndex(activeIndex + (event.code === 'ArrowDown' ? 1 : -1));
		} else if (event.code === 'Home' && isOpen) {
			event.preventDefault();
			setActiveIndex(0);
		} else if (event.code === 'End' && isOpen) {
			event.preventDefault();
			setActiveIndex(options.length - 1);
		} else if ((event.code === 'Enter' || event.code === 'Space') && isOpen) {
			event.preventDefault();
			selectFamily(families[activeIndex].value);
			close({ returnFocus: true });
		}
	};

	const handleOutsidePointer = (event) => {
		if (isOpen && !root.contains(event.target)) close();
	};
	const handleLocaleChange = () => {
		trigger.setAttribute('aria-label', t('ui.textFontFamily'));
		listbox.setAttribute('aria-label', t('ui.textFontFamily'));
		options.forEach(({ label, family }) => { label.textContent = renderOptionLabel(family); });
		updateOptions();
	};

	trigger.addEventListener('click', handleTriggerClick);
	trigger.addEventListener('keydown', handleTriggerKeydown);
	listbox.addEventListener('pointerdown', handleOptionPointerdown);
	listbox.addEventListener('click', handleOptionClick);
	document.addEventListener('pointerdown', handleOutsidePointer, true);
	eventTarget?.addEventListener?.('paint:locale-change', handleLocaleChange);
	root.classList.add('font-family-picker');
	root.replaceChildren(trigger, listbox);
	updateOptions();

	return Object.freeze({
		setValue(nextValue) {
			if (!families.some((family) => family.value === nextValue)) return false;
			currentValue = nextValue;
			updateOptions();
			return true;
		},
		destroy() {
			document.removeEventListener('pointerdown', handleOutsidePointer, true);
			eventTarget?.removeEventListener?.('paint:locale-change', handleLocaleChange);
			trigger.removeEventListener('click', handleTriggerClick);
			trigger.removeEventListener('keydown', handleTriggerKeydown);
			listbox.removeEventListener('pointerdown', handleOptionPointerdown);
			listbox.removeEventListener('click', handleOptionClick);
			root.replaceChildren();
		},
	});
};
