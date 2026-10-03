const findDialogTitle = (dialog) => dialog.querySelector(
	'h1, h2, h3, [role="heading"]',
);

const configureCloseButton = (button, dialog, documentRef) => {
	if (!button) {
		button = documentRef.createElement('button');
		button.type = 'button';
		button.className = 'settings-close';
		button.textContent = '×';
		button.setAttribute('aria-label', 'Close');
		button.setAttribute('title', 'Close');
		button.setAttribute('data-i18n-attr', 'aria-label:common.actions.close,title:common.actions.close');
		button.addEventListener('click', () => {
			const EventConstructor = documentRef.defaultView?.Event || globalThis.Event;
			const cancelEvent = new EventConstructor('cancel', { cancelable: true });
			if (dialog.dispatchEvent(cancelEvent) && dialog.open) dialog.close();
		});
	} else {
		button.classList.add('settings-close');
		button.classList.remove('app-dialog-close');
	}
	return button;
};

export const standardizeDialogFrame = ({ dialog, documentRef = globalThis.document } = {}) => {
	if (!dialog || !documentRef?.createElement) {
		throw new TypeError('Dialog frame requires a dialog and document');
	}

	if (dialog.id === 'settings-dialog') {
		dialog.querySelector('.settings-header')?.classList.add('dialog-header');
		dialog.querySelector('.settings-footer')?.classList.add('dialog-footer');
		dialog.dataset.dialogFrame = 'settings';
		return Object.freeze({ dialog, frame: dialog.querySelector('.settings-shell'), destroy() {} });
	}
	if (dialog.dataset.dialogFrame === 'standard') {
		return Object.freeze({ dialog, frame: dialog.querySelector('.dialog-frame'), destroy() {} });
	}

	const form = [...dialog.children].find((child) => child.tagName === 'FORM') || dialog;
	const existingHeader = [...form.children].find((child) => (
		child.matches?.('header, .app-dialog-header, [data-dialog-header]')
	));
	const title = existingHeader?.querySelector('h1, h2, h3, [role="heading"]') || findDialogTitle(dialog);
	if (!title) throw new Error(`Dialog "${dialog.id || 'unnamed'}" requires a heading`);
	const actions = [...form.children].find((child) => child.classList?.contains('dialog-actions'));
	const closeButton = existingHeader?.querySelector('button.settings-close, button.app-dialog-close');
	const header = existingHeader || documentRef.createElement('header');
	header.classList.add('dialog-header');
	if (!existingHeader) header.append(title);
	header.append(configureCloseButton(closeButton, dialog, documentRef));

	if (!title.id) title.id = `${dialog.id || 'dialog'}-title`;
	dialog.setAttribute('aria-labelledby', title.id);

	const body = documentRef.createElement('div');
	body.className = 'dialog-body';
	const footer = documentRef.createElement('footer');
	footer.className = 'dialog-footer';
	if (actions) footer.append(actions);
	const frame = documentRef.createElement('div');
	frame.className = 'dialog-frame';

	[...form.childNodes].forEach((node) => {
		if (node === header || node === title || node === actions) return;
		body.append(node);
	});
	frame.append(header, body, footer);
	form.replaceChildren(frame);
	dialog.dataset.dialogFrame = 'standard';
	return Object.freeze({ dialog, frame, header, body, footer, destroy() {} });
};

export const standardizeDialogFrames = ({ root = globalThis.document } = {}) => {
	if (!root?.querySelectorAll) throw new TypeError('Dialog frame root must support querySelectorAll');
	return [...root.querySelectorAll('dialog')].map((dialog) => standardizeDialogFrame({ dialog }));
};
