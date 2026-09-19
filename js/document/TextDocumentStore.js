// Durable text-object boundary for Step 06. The raster compositor is still
// intentionally separate; this store only owns normalized editable metadata.

const MAX_TEXT_OBJECTS = 1000;

function clone(value) {
	return typeof structuredClone === 'function'
		? structuredClone(value)
		: JSON.parse(JSON.stringify(value));
}

function makeId() {
	return `text-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeObject(value = {}) {
	return {
		id: typeof value.id === 'string' && value.id ? value.id : makeId(),
		text: String(value.text || ''),
		x: Number(value.x) || 0,
		y: Number(value.y) || 0,
		width: Math.max(0, Number(value.width) || 0),
		height: Math.max(0, Number(value.height) || 0),
		fontSize: Math.max(1, Number(value.fontSize) || 16),
		fontFamily: String(value.fontFamily || 'Segoe UI'),
		color: value.color && typeof value.color === 'object' ? clone(value.color) : { r: 0, g: 0, b: 0, a: 1 },
		styles: Array.isArray(value.styles) ? [...new Set(value.styles.map(String))] : [],
		zIndex: Number.isFinite(Number(value.zIndex)) ? Number(value.zIndex) : 0,
		revision: Math.max(0, Number(value.revision) || 0),
	};
}

export function createTextDocumentStore(initial = []) {
	let objects = initial.slice(0, MAX_TEXT_OBJECTS).map(normalizeObject);
	const listeners = new Set();

	function notify() {
		const snapshot = getAll();
		listeners.forEach((listener) => listener(snapshot));
	}

	function getAll() {
		return clone(objects).sort((a, b) => a.zIndex - b.zIndex);
	}

	function add(value) {
		if (objects.length >= MAX_TEXT_OBJECTS) return null;
		const object = normalizeObject(value);
		objects = [...objects, object];
		notify();
		return clone(object);
	}

	function update(id, patch = {}) {
		const index = objects.findIndex((object) => object.id === id);
		if (index < 0) return null;
		const next = normalizeObject({ ...objects[index], ...patch, id, revision: objects[index].revision + 1 });
		objects = objects.map((object, itemIndex) => itemIndex === index ? next : object);
		notify();
		return clone(next);
	}

	function remove(id) {
		const next = objects.filter((object) => object.id !== id);
		if (next.length === objects.length) return false;
		objects = next;
		notify();
		return true;
	}

	function replace(value = []) {
		objects = value.slice(0, MAX_TEXT_OBJECTS).map(normalizeObject);
		notify();
	}

	function subscribe(listener) {
		if (typeof listener !== 'function') return () => {};
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	return Object.freeze({
		add,
		update,
		remove,
		replace,
		getAll,
		subscribe,
		serialize: () => JSON.stringify(getAll()),
	});
}

export { MAX_TEXT_OBJECTS };
