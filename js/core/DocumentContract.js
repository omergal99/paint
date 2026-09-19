import { SCHEMA_VERSIONS } from './constants.js';

function makeId() {
	return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPaintDocument({ id = makeId(), width = 800, height = 600, metadata = {} } = {}) {
	return {
		schemaVersion: SCHEMA_VERSIONS.document,
		id,
		pixels: { width, height },
		selection: null,
		textObjects: [],
		history: { undo: [], redo: [] },
		dirty: false,
		metadata: { ...metadata },
	};
}

export function isPaintDocument(value) {
	return Boolean(value
		&& value.schemaVersion === SCHEMA_VERSIONS.document
		&& typeof value.id === 'string'
		&& value.pixels
		&& Number.isInteger(value.pixels.width)
		&& Number.isInteger(value.pixels.height)
		&& Array.isArray(value.textObjects));
}
