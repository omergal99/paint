import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { Sidebar } from '../../../js/ui/Sidebar.js';

const source = readFileSync(new URL('../../../js/ui/Sidebar.js', import.meta.url), 'utf8');

test('AI quick actions delegate command clicks through their stable root', () => {
	const commands = [];
	const button = {
		dataset: { aiCommand: '/zoom 100' },
		closest(selector) {
			return selector === 'button[data-ai-command]' ? this : null;
		},
	};
	const actionsRoot = { contains: (target) => target === button };
	const sidebar = Object.assign(Object.create(Sidebar.prototype), {
		aiActions: actionsRoot,
		handleAiSubmit: (command) => commands.push(command),
	});

	sidebar._handleAiActionClick({ target: button });
	assert.deepEqual(commands, ['/zoom 100']);

	sidebar._handleAiActionClick({
		target: {
			closest: () => ({ dataset: { aiCommand: '/outside' } }),
		},
	});
	assert.deepEqual(commands, ['/zoom 100'], 'commands outside the quick-actions root are ignored');
});

test('rerendered AI quick-action buttons do not own click listeners', () => {
	const renderActions = source.match(/_renderAiActions\(\) \{[\s\S]*?\n\t\}/)?.[0] || '';
	const delegatedHandler = source.match(/_handleAiActionClick\(event\) \{[\s\S]*?\n\t\}/)?.[0] || '';

	assert.doesNotMatch(renderActions, /addEventListener/);
	assert.match(renderActions, /button\.dataset\.aiCommand = command/);
	assert.match(source, /this\.aiActions\?\.addEventListener\('click', \(event\) => this\._handleAiActionClick\(event\)\)/);
	assert.match(delegatedHandler, /button\[data-ai-command\]/);
	assert.match(delegatedHandler, /this\.aiActions\.contains\(button\)/);
	assert.match(delegatedHandler, /this\.handleAiSubmit\(button\.dataset\.aiCommand\)/);
});

test('history restore only flashes success when the load actually succeeded', () => {
	// The restore path must check the boolean returned by loadImageDataUrl /
	// historyManager.restore before flashing a success message. Previously the
	// flash fired unconditionally, overwriting the error message emitted by
	// onImageLoadError/onAdmissionRejected when the decode or admission failed.
	const handler = source.match(/async _handleHistoryItemClick\(event\) \{[\s\S]*?\n\t\}/)?.[0] || '';
	assert.ok(handler.length > 0, '_handleHistoryItemClick source must be found');

	// Global history path: loadImageDataUrl result is captured and gated.
	assert.match(handler, /const loaded = await this\.canvasManager\.loadImageDataUrl\(/);
	assert.match(handler, /if \(loaded\) this\.statusBar\.flash\(t\('ui\.loadedFromHistory'\)\)/);

	// Session history path: historyManager.restore result is captured and gated.
	assert.match(handler, /const restored = await this\.historyManager\.restore\(entry\)/);
	assert.match(handler, /if \(restored\) this\.statusBar\.flash\(t\('ui\.restoredSessionStep'\)\)/);
});

test('history restore does not flash a success message after a failed load', async () => {
	// Behavioural regression: simulate a failed global-history load and assert
	// that statusBar.flash is never called with the success message.
	const flashes = [];
	const sidebar = Object.assign(Object.create(Sidebar.prototype), {
		historyGrid: { contains: () => true },
		_historyItemsByKey: new Map([['global:1', {
			type: 'global',
			entry: { dataUrl: 'data:image/png;base64,broken', width: 10, height: 10 },
			index: 0,
		}]]),
		dialogService: { confirm: async () => true },
		canvasManager: { loadImageDataUrl: async () => false },
		statusBar: { flash: (msg) => flashes.push(msg) },
	});

	// The handler first calls event.target.closest('[data-history-action]'),
	// then actionElement.closest('.history-item') to locate the record.
	const item = { dataset: { historyKey: 'global:1' } };
	const actionElement = {
		dataset: { historyAction: 'restore' },
		closest: (sel) => (sel === '.history-item' ? item : null),
	};
	const eventTarget = { closest: (sel) => (sel === '[data-history-action]' ? actionElement : null) };

	await sidebar._handleHistoryItemClick({ target: eventTarget, stopPropagation() {} });
	assert.deepEqual(flashes, [], 'failed load must not flash a success message');

	// Now simulate a successful load and assert the success message fires.
	sidebar.canvasManager.loadImageDataUrl = async () => true;
	await sidebar._handleHistoryItemClick({ target: eventTarget, stopPropagation() {} });
	assert.deepEqual(flashes, ['Loaded from history'], 'successful load flashes the success message');
});

test('manual global-history saves skip a clean canvas before encoding', async () => {
	let encodeCalls = 0;
	const sidebar = Object.assign(Object.create(Sidebar.prototype), {
		globalHistory: { historyEnabled: true },
		canvasManager: {
			isCleanDocument: () => true,
			toBlob: async () => {
				encodeCalls += 1;
				return new Blob(['blank'], { type: 'image/png' });
			},
		},
	});

	assert.equal(await sidebar.saveCurrentToHistory(), false);
	assert.equal(encodeCalls, 0);
});

test('global history drops a duplicate newest image', async () => {
	let addCalls = 0;
	const sidebar = Object.assign(Object.create(Sidebar.prototype), {
		globalHistory: {
			historyEnabled: true,
			getSessions: async () => [{ dataUrl: 'data:image/png;base64,existing' }],
			addSession: async () => { addCalls += 1; },
		},
	});

	assert.equal(await sidebar.saveDataUrlToHistory('data:image/png;base64,existing', 10, 10), false);
	assert.equal(addCalls, 0);
});
