import { ADJUSTMENTS } from '../canvas/AdjustmentEngine.js';
import { EVENTS } from '../core/constants.js';
import { t } from '../i18n/messages.js';

const ICON_PATHS = Object.freeze({
	invert: 'M10 2a8 8 0 1 0 0 16V2Zm0 0a8 8 0 0 1 0 16',
	brightness: 'M10 2v3m0 10v3M2 10h3m10 0h3M4.3 4.3l2.1 2.1m7.2 7.2 2.1 2.1m0-11.4-2.1 2.1m-7.2 7.2-2.1 2.1',
	contrast: 'M10 2a8 8 0 1 0 0 16V2Zm0 0a8 8 0 0 1 0 16',
	hue: 'M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 0v16M2 10h16',
	saturation: 'M10 2s-6 6.2-6 10a6 6 0 0 0 12 0c0-3.8-6-10-6-10Z',
	blur: 'M3 6c2-2 4 2 6 0s4-2 8 0M3 10c2-2 4 2 6 0s4-2 8 0M3 14c2-2 4 2 6 0s4-2 8 0',
	warmCold: 'M8 12V4a2 2 0 1 1 4 0v8a4 4 0 1 1-4 0Zm2-3v6',
	pixelize: 'M3 3h4v4H3zM9 3h4v4H9zM15 3h2v4h-2zM3 9h4v4H3zM9 9h4v4H9zM15 9h2v4h-2zM3 15h4v2H3zM9 15h4v2H9zM15 15h2v2h-2z',
	noise: 'M4 4h.01M10 4h.01M16 4h.01M7 8h.01M13 8h.01M4 12h.01M10 12h.01M16 12h.01M7 16h.01M13 16h.01',
	pattern: 'M3 3h14v14H3zM10 3v14M3 10h14M3 3l14 14M17 3 3 17',
});

const createIcon = (documentRef, id) => {
	const svg = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 20 20');
	svg.setAttribute('class', 'icon size4');
	svg.setAttribute('aria-hidden', 'true');
	const path = documentRef.createElementNS('http://www.w3.org/2000/svg', 'path');
	path.setAttribute('d', ICON_PATHS[id] || ICON_PATHS.brightness);
	path.setAttribute('fill', 'none');
	path.setAttribute('stroke', 'currentColor');
	path.setAttribute('stroke-width', '1.5');
	path.setAttribute('stroke-linecap', 'round');
	path.setAttribute('stroke-linejoin', 'round');
	svg.append(path);
	return svg;
};

export const mountAdjustmentEntries = (host, { buttonClass = 'mirror-action' } = {}) => {
	host.replaceChildren();
	Object.entries(ADJUSTMENTS).forEach(([id, metadata]) => {
		const button = document.createElement('button');
		button.type = 'button';
		button.className = `${buttonClass} mirror-adjustment-action`;
		button.dataset.tag = `open-adjustment-${id}`;
		const documentRef = host.ownerDocument || document;
		const label = documentRef.createElement('span');
		label.textContent = t(metadata.labelKey);
		label.setAttribute('data-i18n-runtime', metadata.labelKey);
		button.append(createIcon(documentRef, id), label);
		button.addEventListener('click', () => {
			window.dispatchEvent(new CustomEvent(EVENTS.openAdjustments, { detail: { id } }));
		});
		host.append(button);
	});
};
