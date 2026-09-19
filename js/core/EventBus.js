// Small lifecycle-safe event contract for cross-feature application events.

export class EventBus {
	constructor() {
		this._listeners = new Map();
		this._destroyed = false;
	}

	on(eventName, listener) {
		if (this._destroyed || typeof listener !== 'function') return () => {};
		if (!this._listeners.has(eventName)) this._listeners.set(eventName, new Set());
		const listeners = this._listeners.get(eventName);
		listeners.add(listener);
		return () => this.off(eventName, listener);
	}

	off(eventName, listener) {
		const listeners = this._listeners.get(eventName);
		if (!listeners) return false;
		const removed = listeners.delete(listener);
		if (!listeners.size) this._listeners.delete(eventName);
		return removed;
	}

	once(eventName, listener) {
		if (typeof listener !== 'function') return () => {};
		const unsubscribe = this.on(eventName, (payload) => {
			unsubscribe();
			listener(payload);
		});
		return unsubscribe;
	}

	emit(eventName, payload) {
		if (this._destroyed) return 0;
		const listeners = this._listeners.get(eventName);
		if (!listeners) return 0;
		[...listeners].forEach((listener) => listener(payload));
		return listeners.size;
	}

	destroy() {
		this._listeners.clear();
		this._destroyed = true;
	}
}

export function createEventBus() {
	return new EventBus();
}
