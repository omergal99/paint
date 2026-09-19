import { SCHEMA_VERSIONS } from './constants.js';

const makeId = () => {
	return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const createPaintDocument = ({ id = makeId(), width = 800, height = 600, metadata = {} } = {}) => {
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

export const isPaintDocument = (value) => {
	return Boolean(value
		&& value.schemaVersion === SCHEMA_VERSIONS.document
		&& typeof value.id === 'string'
		&& value.pixels
		&& Number.isInteger(value.pixels.width)
		&& Number.isInteger(value.pixels.height)
		&& Array.isArray(value.textObjects));
}
