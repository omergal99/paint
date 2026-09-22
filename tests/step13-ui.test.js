import quieterAssert from './helpers/quieter-assert.mjs';
const assert = quieterAssert;
import test from 'node:test';

import { createPaintDocument } from '../js/core/DocumentContract.js';
import { createSessionService } from '../js/session/SessionService.js';
import { createTabBarModel } from '../js/ui/TabBar.js';
import { SPLIT_VIEW_LIMITS, createSplitViewModel } from '../js/ui/SplitView.js';
import { createWorkspaceStripController, createWorkspaceStripModel } from '../js/ui/WorkspaceStrip.js';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.resolve(import.meta.dirname, '../css/styles.css'), 'utf8');
const tabBarSource = fs.readFileSync(path.resolve(import.meta.dirname, '../js/ui/TabBar.js'), 'utf8');
const splitSource = fs.readFileSync(path.resolve(import.meta.dirname, '../js/ui/SplitView.js'), 'utf8');

const document = (id, label, dirty = false) => ({
	...createPaintDocument({ id, metadata: { label } }),
	dirty,
});

test('TabBar model preserves session order, active state, labels, and dirty indicator', () => {
	const model = createTabBarModel({
		documents: [document('one', 'Portrait', true), document('two', '')],
		activeDocumentId: 'two',
	});
	assert.deepEqual(model.map(({ id, label, dirty, active }) => ({ id, label, dirty, active })), [
		{ id: 'one', label: 'Portrait', dirty: true, active: false },
		{ id: 'two', label: 'Image 2', dirty: false, active: true },
	]);
});

test('SplitView model reflects pane assignments and bounds divider ratio', () => {
	const state = { activePane: 'secondary', panes: { primary: 'one', secondary: 'two' } };
	assert.deepEqual(createSplitViewModel(state, 99), {
		activePane: 'secondary',
		primaryDocumentId: 'one',
		secondaryDocumentId: 'two',
		isSplit: true,
		ratio: SPLIT_VIEW_LIMITS.max,
	});
	assert.equal(createSplitViewModel({ panes: { primary: 'one', secondary: null } }, 1).isSplit, false);
});

test('SessionService pane contract supports the first split-view toggle lifecycle', () => {
	const service = createSessionService({ initialDocuments: [document('one', 'One'), document('two', 'Two')] });
	assert.equal(service.getState().panes.secondary, null);
	assert.equal(service.setPaneDocument('secondary', 'two').ok, true);
	assert.equal(createSplitViewModel(service.getState()).isSplit, true);
	assert.equal(service.setActivePane('secondary').ok, true);
	assert.equal(service.getState().activeDocumentId, 'two');
	assert.equal(service.setPaneDocument('secondary', null).ok, true);
	assert.equal(createSplitViewModel(service.getState()).isSplit, false);
});

test('SplitView toggle provisions a second session document when needed', () => {
	const service = createSessionService({ initialDocuments: [document('one', 'One')] });
	const split = createSplitViewModel(service.getState());
	assert.equal(split.isSplit, false);
	// The UI controller provisions the second tab on demand; the service itself
	// remains the source of truth for the resulting pane assignment.
	const created = service.createDocument({ activate: false, metadata: { label: 'Image 2' } });
	assert.equal(created.ok, true);
	assert.equal(service.setPaneDocument('secondary', created.document.id).ok, true);
	assert.equal(createSplitViewModel(service.getState()).isSplit, true);
});

test('workspace controls stay compact and expose accessible tab/manage semantics', () => {
	assert.match(tabBarSource, /onManage/);
	assert.match(tabBarSource, /role', 'tab'/);
	assert.match(tabBarSource, /workspace-tab-manage/);
	assert.match(css, /\.workspace-tab\s*\{[\s\S]*min-width:\s*0/);
	assert.match(css, /\.workspace-tab\s*\{[\s\S]*max-width:\s*168px/);
	assert.match(css, /\.workspace-tab\.is-active/);
});

test('split view exposes pane assignment and RTL-safe pointer teardown', () => {
	assert.match(splitSource, /workspace-pane-select/);
	assert.match(splitSource, /setPaneDocument/);
	assert.match(splitSource, /getComputedStyle\(root\)\.direction/);
	assert.match(splitSource, /pointercancel/);
	assert.match(splitSource, /workspace-pane-frame/);
	assert.match(splitSource, /setVisible/);
	assert.match(splitSource, /openSplit/);
	assert.match(css, /workspace-split-host:not\(.is-expanded\) \.workspace-split-panes/);
	assert.match(css, /workspace-split-host\.is-expanded\s*\{[\s\S]*position:\s*fixed/);
});

test('workspace strip visibility is a reusable independent state model', () => {
	assert.deepEqual(createWorkspaceStripModel(), { visible: false, mode: 'tabs' });
	assert.deepEqual(createWorkspaceStripModel({ visible: false, mode: 'split' }), { visible: false, mode: 'split' });
	assert.deepEqual(createWorkspaceStripModel({ mode: 'unknown' }), { visible: false, mode: 'tabs' });
});

test('workspace split host is outside the strip and visibility has a storage contract', () => {
	assert.match(css, /workspace-content/);
	assert.match(css, /workspace-split-host/);
	assert.match(splitSource, /workspace-split-panes/);
	const source = fs.readFileSync(path.resolve(import.meta.dirname, '../js/ui/WorkspaceStrip.js'), 'utf8');
	assert.match(source, /storageKey/);
	assert.match(source, /getItem/);
	assert.match(source, /setItem/);
});

test('workspace strip controller restores and persists visibility safely', () => {
	const values = new Map([['workspace', '1']]);
	const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
	const listeners = new Map();
	const button = {
		dataset: {},
		setAttribute(name, value) { this[name] = value; },
		addEventListener(name, handler) { listeners.set(name, handler); },
		removeEventListener() {},
	};
	const root = { hidden: false, setAttribute(name, value) { this[name] = value; } };
	const controller = createWorkspaceStripController({ root, toggleButton: button, storage, storageKey: 'workspace', defaultVisible: false });
	assert.equal(controller.getState().visible, true);
	listeners.get('click')();
	assert.equal(controller.getState().visible, false);
	assert.equal(values.get('workspace'), '0');
	controller.destroy();
});
