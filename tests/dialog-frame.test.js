import assert from 'node:assert/strict';
import test from 'node:test';
import { isDialogBackdropClick } from '../js/ui/DialogFrame.js';

const createDialog = () => ({
	getBoundingClientRect: () => ({ left: 100, right: 500, top: 100, bottom: 400 }),
});

test('dialog padding clicks do not count as backdrop clicks', () => {
	const dialog = createDialog();
	assert.equal(isDialogBackdropClick({
		dialog,
		event: { target: dialog, clientX: 110, clientY: 110 },
	}), false);
});

test('only coordinates outside the dialog rectangle dismiss it', () => {
	const dialog = createDialog();
	assert.equal(isDialogBackdropClick({
		dialog,
		event: { target: dialog, clientX: 50, clientY: 200 },
	}), true);
	assert.equal(isDialogBackdropClick({
		dialog,
		event: { target: {}, clientX: 50, clientY: 200 },
	}), false);
});
