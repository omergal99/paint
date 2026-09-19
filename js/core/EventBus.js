// Small lifecycle-safe event contract for cross-feature application events.
// This is intentionally a closure-based factory: event state is private and
// the public surface is a plain object of functions, not a class instance.

export function createEventBus() {
	const listenersByEvent = new Map();
	let destroyed = false;

	function on(eventName, listener) {
		if (destroyed || typeof listener !== 'function') return () => {};
		if (!listenersByEvent.has(eventName)) listenersByEvent.set(eventName, new Set());
		const listeners = listenersByEvent.get(eventName);
		listeners.add(listener);
		return () => off(eventName, listener);
	}

	function off(eventName, listener) {
		const listeners = listenersByEvent.get(eventName);
		if (!listeners) return false;
		const removed = listeners.delete(listener);
		if (!listeners.size) listenersByEvent.delete(eventName);
		return removed;
	}

	function once(eventName, listener) {
		if (typeof listener !== 'function') return () => {};
		let unsubscribe = () => {};
		unsubscribe = on(eventName, (payload) => {
			unsubscribe();
			listener(payload);
		});
		return unsubscribe;
	}

	function emit(eventName, payload) {
		if (destroyed) return 0;
		const listeners = listenersByEvent.get(eventName);
		if (!listeners) return 0;
		[...listeners].forEach((listener) => listener(payload));
		return listeners.size;
	}

	function destroy() {
		listenersByEvent.clear();
		destroyed = true;
	}

	return Object.freeze({ on, off, once, emit, destroy });
}
