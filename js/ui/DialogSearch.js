// Reusable text search for modal panels. The controller only knows about
// tabs, panels, and a result callback, so another dialog can adopt it without
// depending on Paint's Settings-specific markup.

const SEARCHABLE_SELECTOR = [
	'h2', 'h3', 'h4', 'p', 'li', 'label', 'legend', 'button', 'summary', 'strong',
	'.settings-field', '.checkbox-row', '.dialog-actions', '.pwa-install-card',
	'.pwa-update-card', '.pwa-offline-card', '.feedback-actions', '.about-stats > div',
	'.shortcut-setting-row', '.ribbon-setting-row',
].join(',');

const resultOwner = (element, panel) => element.closest(SEARCHABLE_SELECTOR) || panel;

const addDeepestOwner = (owners, owner) => {
	if (owners.includes(owner)) return;
	// If a parent/card and one of its descendants both match, keep only the
	// descendant. The parent can still be styled by normal CSS if desired, but
	// it must not inflate the result count or receive a second focus stop.
	if (owners.some((existing) => existing.contains(owner))) {
		for (let index = owners.length - 1; index >= 0; index -= 1) {
			if (owners[index].contains(owner)) owners.splice(index, 1);
		}
	}
	if (!owners.some((existing) => owner.contains(existing))) owners.push(owner);
};

export const createDialogSearch = ({
	dialog,
	input,
	status,
	previousButton,
	nextButton,
	tabs = [],
	panels = [],
	onSelectTab = () => {},
} = {}) => {
	const tabList = [...tabs];
	const panelList = [...panels];
	let results = [];
	let activeIndex = -1;
	const searchShell = input?.closest?.('.settings-search');

	const setNavigationState = (visible) => {
		[previousButton, nextButton].forEach((button) => {
			if (!button) return;
			button.hidden = !visible;
			button.disabled = !visible;
		});
		searchShell?.classList.toggle('settings-search-has-results', visible);
	};

	const clear = () => {
		panelList.forEach((panel) => {
			panel.querySelectorAll('.dialog-search-match, .dialog-search-active').forEach((element) => {
				element.classList.remove('dialog-search-match', 'dialog-search-active');
			});
		});
		tabList.forEach((tab) => {
			tab.classList.remove('dialog-search-tab-match', 'dialog-search-tab-active');
			delete tab.dataset.searchMatchCount;
		});
		results = [];
		activeIndex = -1;
		setNavigationState(false);
		if (status) status.textContent = '';
	};

	const search = (rawQuery = input?.value || '') => {
		const query = String(rawQuery).trim();
		clear();
		if (query.length < 2) return [];
		const normalized = query.toLocaleLowerCase();
		panelList.forEach((panel) => {
			const tab = tabList.find((candidate) => candidate.dataset.settingsTab === panel.dataset.settingsPanel);
			const panelText = panel.textContent.toLocaleLowerCase();
			const owners = [];
			const candidates = [...panel.querySelectorAll(SEARCHABLE_SELECTOR)];
			candidates.forEach((candidate) => {
				if (!candidate.textContent.toLocaleLowerCase().includes(normalized)) return;
				addDeepestOwner(owners, resultOwner(candidate, panel));
			});
			if (!candidates.length && panelText.includes(normalized)) owners.push(panel);
			owners.forEach((owner) => results.push({ owner, panel, tab }));
			if (owners.length && tab) {
				tab.classList.add('dialog-search-tab-match');
				tab.dataset.searchMatchCount = String(owners.length);
			}
		});
		results.forEach(({ owner }) => owner.classList.add('dialog-search-match'));
		if (results.length) {
			setNavigationState(true);
			focusResult(1);
		} else if (status) status.textContent = '0/0';
		return results;
	};

	const focusResultAt = (index) => {
		if (!results.length) return false;
		activeIndex = (index + results.length) % results.length;
		const result = results[activeIndex];
		results.forEach(({ owner }, index) => owner.classList.toggle('dialog-search-active', index === activeIndex));
		tabList.forEach((tab) => tab.classList.toggle('dialog-search-tab-active', tab === result.tab));
		if (result.tab) onSelectTab(result.tab.dataset.settingsTab);
		result.owner.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
		if (status) status.textContent = `${activeIndex + 1}/${results.length}`;
		return true;
	};

	const focusResult = (direction = 1) => focusResultAt(activeIndex + direction);

	const bind = () => {
		input?.addEventListener('input', () => search());
		input?.addEventListener('keydown', (event) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') return;
			if (event.key === 'Escape') {
				event.preventDefault();
				if (input) input.value = '';
				clear();
				return;
			}
			if (event.key !== 'Enter') return;
			event.preventDefault();
			if (!results.length) search();
			focusResult(event.shiftKey ? -1 : 1);
		});
		previousButton?.addEventListener('click', () => focusResult(-1));
		nextButton?.addEventListener('click', () => focusResult(1));
		tabList.forEach((tab) => tab.addEventListener('click', () => {
			const firstResultIndex = results.findIndex((result) => result.tab === tab);
			if (firstResultIndex >= 0) focusResultAt(firstResultIndex);
		}));
		dialog?.addEventListener('close', () => {
			if (input) input.value = '';
			clear();
		});
	};

	return Object.freeze({ bind, clear, search, next: () => focusResult(1), previous: () => focusResult(-1), getResults: () => [...results] });
};
