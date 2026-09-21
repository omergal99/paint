import assert from 'node:assert/strict';
import test from 'node:test';

import { createPaintDocument } from '../js/core/DocumentContract.js';
import {
	MAX_SESSION_DOCUMENTS,
	SESSION_ERROR_CODES,
	createSessionService,
} from '../js/session/SessionService.js';
import {
	RECOVERY_CLASSIFICATIONS,
	RECOVERY_ERROR_CODES,
	createRecoveryService,
	createRecoverySnapshot,
} from '../js/session/RecoveryService.js';

const document = (id, width = 40, height = 30) => createPaintDocument({ id, width, height, metadata: { label: id } });

const memoryStorage = () => {
	const values = new Map();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, String(value)),
		removeItem: (key) => values.delete(key),
		peek: (key) => values.get(key) ?? null,
	};
};

test('SessionService keeps ordered documents, pane focus, dirty state, and undo-close', () => {
	const service = createSessionService({ initialDocuments: [document('one'), document('two')] });
	assert.deepEqual(service.getState().tabOrder, ['one', 'two']);
	assert.equal(service.setPaneDocument('secondary', 'two').ok, true);
	assert.equal(service.setActivePane('secondary').ok, true);
	assert.equal(service.getState().activeDocumentId, 'two');
	assert.equal(service.markDirty('two').document.dirty, true);

	const closed = service.closeDocument('two');
	assert.equal(closed.ok, true);
	assert.equal(service.getState().documents.length, 1);
	assert.equal(service.getState().canUndoClose, true);
	assert.equal(service.getState().activeDocumentId, 'one');

	const reopened = service.undoClose();
	assert.equal(reopened.ok, true);
	assert.deepEqual(service.getState().tabOrder, ['one', 'two']);
	assert.equal(service.getState().activePane, 'secondary');
	assert.equal(service.getState().activeDocumentId, 'two');
	assert.equal(service.getDocument('two').dirty, true);
});

test('SessionService enforces ten documents and retains at least one', () => {
	const service = createSessionService({ initialDocuments: [document('base')] });
	for (let index = 1; index < MAX_SESSION_DOCUMENTS; index += 1) {
		assert.equal(service.createDocument({ id: `doc-${index}` }).ok, true);
	}
	assert.equal(service.getState().documents.length, MAX_SESSION_DOCUMENTS);
	assert.equal(service.createDocument({ id: 'one-too-many' }).error.code, SESSION_ERROR_CODES.documentLimit);
	assert.equal(service.closeDocument('base').ok, true);
	for (const id of [...service.getState().tabOrder]) {
		if (service.getState().documents.length > 1) assert.equal(service.closeDocument(id).ok, true);
	}
	assert.equal(service.getState().documents.length, 1);
	assert.equal(service.closeDocument().error.code, SESSION_ERROR_CODES.lastDocument);
});

test('SessionService rejects malformed restore data and releases subscriptions on disposal', () => {
	const service = createSessionService({ initialDocuments: [document('safe')] });
	let events = 0;
	service.subscribe(() => { events += 1; });
	const invalid = service.restore({ schemaVersion: 1, documents: [], tabOrder: [] });
	assert.equal(invalid.ok, false);
	assert.equal(service.getState().documents[0].id, 'safe');
	service.markDirty('safe');
	assert.equal(events, 1);
	assert.equal(service.getDiagnostics().listenerCount, 1);
	assert.equal(service.dispose(), true);
	assert.equal(service.getDiagnostics().listenerCount, 0);
	assert.equal(service.markDirty('safe').error.code, SESSION_ERROR_CODES.disposed);
	assert.equal(events, 1, 'disposed services do not retain or invoke listeners');
});

test('RecoveryService classifies a crash with a valid unexpired shell and keeps it until explicitly discarded', () => {
	const storage = memoryStorage();
	let time = 1_000;
	const session = createSessionService({ initialDocuments: [document('one'), document('two')] });
	session.setPaneDocument('secondary', 'two');
	session.setActivePane('secondary');
	session.markDirty('two');
	const writer = createRecoveryService({ storage, now: () => time, ttlMs: 500 });
	assert.equal(writer.saveSnapshot(session.getRecoveryState()).ok, true);
	assert.equal(writer.armCrashFlag().ok, true);

	const reader = createRecoveryService({ storage, now: () => time + 100, ttlMs: 500 });
	const recovered = reader.inspect();
	assert.equal(recovered.ok, true);
	assert.equal(recovered.classification, RECOVERY_CLASSIFICATIONS.recoverable);
	assert.deepEqual(recovered.session.tabOrder, ['one', 'two']);
	assert.equal(recovered.session.activeDocumentId, 'two');

	assert.equal(reader.markCleanExit().ok, true);
	const clean = reader.inspect();
	assert.equal(clean.classification, RECOVERY_CLASSIFICATIONS.clean);
	assert.ok(storage.peek(reader.getKeys().snapshot), 'clean exit does not silently delete a recovery record');
	assert.equal(reader.discardRecovery().ok, true);
	assert.equal(reader.inspect().classification, RECOVERY_CLASSIFICATIONS.none);
});

test('RecoveryService marks expired or malformed data safely without auto-deleting it', () => {
	const storage = memoryStorage();
	let time = 10_000;
	const session = createSessionService({ initialDocuments: [document('one')] });
	const writer = createRecoveryService({ storage, now: () => time, ttlMs: 50 });
	writer.saveSnapshot(session.getRecoveryState());
	writer.armCrashFlag();

	time += 100;
	const expiredReader = createRecoveryService({ storage, now: () => time, ttlMs: 50 });
	const expired = expiredReader.inspect();
	assert.equal(expired.classification, RECOVERY_CLASSIFICATIONS.expired);
	assert.ok(storage.peek(expiredReader.getKeys().snapshot), 'TTL classification is read-only');

	storage.setItem(expiredReader.getKeys().snapshot, '{broken json');
	const malformed = expiredReader.inspect();
	assert.equal(malformed.classification, RECOVERY_CLASSIFICATIONS.malformed);
	assert.ok(storage.peek(expiredReader.getKeys().snapshot), 'malformed data waits for an explicit discard');
	assert.equal(expiredReader.discardRecovery().ok, true);
	assert.equal(storage.peek(expiredReader.getKeys().snapshot), null);
});

test('Recovery snapshots are bounded and service disposal owns no external listeners', () => {
	const session = createSessionService({ initialDocuments: [document('one')] });
	const tooSmall = createRecoverySnapshot({ sessionState: session.getRecoveryState(), now: 1, maxBytes: 1 });
	assert.equal(tooSmall.ok, false);
	assert.equal(tooSmall.error.code, RECOVERY_ERROR_CODES.snapshotTooLarge);

	const recovery = createRecoveryService({ storage: memoryStorage() });
	assert.equal(recovery.getDiagnostics().listenerCount, 0);
	assert.equal(recovery.dispose(), true);
	assert.equal(recovery.getDiagnostics().listenerCount, 0);
	assert.equal(recovery.inspect().error.code, RECOVERY_ERROR_CODES.disposed);
});
