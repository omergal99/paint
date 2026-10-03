import { ADJUSTMENTS } from '../canvas/AdjustmentEngine.js';
import { EVENTS } from '../core/constants.js';
import { t } from '../i18n/messages.js';

export const mountAdjustmentEntries = (host, { buttonClass = 'mirror-action' } = {}) => {
	host.replaceChildren();
	Object.entries(ADJUSTMENTS).forEach(([id, metadata]) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = buttonClass;
		button.dataset.tag = `open-adjustment-${id}`;
		button.textContent = t(metadata.labelKey);
		button.setAttribute('data-i18n-runtime', metadata.labelKey);
		button.addEventListener('click', () => {
			window.dispatchEvent(new CustomEvent(EVENTS.openAdjustments, { detail: { id } }));
		});
		host.append(button);
	});
};
