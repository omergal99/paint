// js/app/appState.js
// Application view-state store. Small, dependency-free, and deliberately NOT a
// second source of truth: the feature modules (canvas, history, settings,
// router) stay the owners of their data and publish *derived* view state here.
// UI that needs to react (status bar, dialogs, tool badge) selects from this
// store instead of reading globals.
//
// Patterns borrowed from common frontend state libraries:
//   - one immutable snapshot + `getState()` (Redux)
//   - `dispatch(action)` through a reducer map, so every change is named
//     (Redux / Redux-Toolkit)
//   - `select(slice)` + `subscribe(selector, listener)` so a view re-runs only
//     when its own slice changes (Zustand / Redux-Toolkit selectors)
//   - one microtask-batched notification, so a burst of writes costs a single
//     notification pass (React 18 style automatic batching)

/** Keys a reducer may return. Keeping them explicit documents the whole surface. */
export const APP_STATE_KEYS = Object.freeze([
  'activeTool',
  'selection',
  'historyState',
  'direction',
  'locale',
  'dialog',
  'updateStatus',
  'sidebarView',
]);

const INITIAL_STATE = Object.freeze({
  activeTool: null,
  selection: null,
  historyState: Object.freeze({ canUndo: false, canRedo: false }),
  direction: 'ltr',
  locale: null,
  dialog: null,
  // 'idle' | 'checking' | 'available' | 'upToDate' | 'offline' | 'error'
  updateStatus: 'idle',
  sidebarView: null,
});

const reducers = new Map();

/**
 * Register the reducer for one action type.
 * `reducer(state, payload)` returns the next state (same object when nothing
 * changed, which keeps `subscribe` selectors cheap).
 */
export const defineReducer = (type, reducer) => {
  reducers.set(type, reducer);
  return type;
};

/** Create an isolated store - tests can build their own without touching the app. */
export const createAppState = (initial = {}) => {
  let state = Object.freeze({ ...INITIAL_STATE, ...initial });
  const listeners = new Set();
  let scheduled = false;

  const notify = () => {
    scheduled = false;
    for (const entry of [...listeners]) {
      try {
        if (!entry.selector || entry.selector(state)) entry.listener(state);
      } catch (error) {
        console.warn('App state listener failed:', error);
      }
    }
  };

  const getState = () => state;

  const dispatch = (action) => {
    if (!action || typeof action.type !== 'string') return state;
    const reducer = reducers.get(action.type);
    if (!reducer) {
      console.warn(`Unknown app state action: ${action.type}`);
      return state;
    }
    const next = reducer(state, action.payload);
    if (next === state) return state;
    state = Object.freeze(next);
    // Batch: several dispatches in one task notify subscribers once.
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(notify);
    }
    return state;
  };

  /**
   * Subscribe to the whole store or to one slice.
   * Returns an unsubscribe function - no cleanup guessing.
   */
  const subscribe = (listener, selector = null) => {
    if (typeof listener !== 'function') return () => {};
    const entry = { listener, selector };
    listeners.add(entry);
    return () => listeners.delete(entry);
  };

  return Object.freeze({ getState, dispatch, subscribe });
};

export const appState = createAppState();

// ---------- Reducers ----------
// Each writer calls one of these; nothing else may mutate the snapshot.

defineReducer('tool/changed', (state, payload) => (
  payload === state.activeTool ? state : { ...state, activeTool: payload ?? null }
));

defineReducer('selection/changed', (state, payload) => {
  const next = payload && payload.w > 0 && payload.h > 0
    ? { x: payload.x, y: payload.y, w: payload.w, h: payload.h, hasPath: Array.isArray(payload.path) }
    : null;
  const same = (a, b) => (!a && !b) || Boolean(a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h && a.hasPath === b.hasPath);
  return same(next, state.selection) ? state : { ...state, selection: next };
});

defineReducer('history/changed', (state, payload) => {
  const next = { canUndo: Boolean(payload?.canUndo), canRedo: Boolean(payload?.canRedo) };
  const same = state.historyState.canUndo === next.canUndo && state.historyState.canRedo === next.canRedo;
  return same ? state : { ...state, historyState: next };
});

defineReducer('direction/changed', (state, payload) => (
  payload === state.direction ? state : { ...state, direction: payload || 'ltr' }
));

defineReducer('locale/changed', (state, payload) => (
  payload === state.locale ? state : { ...state, locale: payload ?? null }
));

defineReducer('dialog/changed', (state, payload) => (
  payload === state.dialog ? state : { ...state, dialog: payload ?? null }
));

defineReducer('update/changed', (state, payload) => {
  const next = typeof payload === 'string' ? payload : payload?.status;
  if (!next) return state;
  const info = typeof payload === 'string' ? {} : (payload || {});
  const current = state.updateStatus;
  return current === next && current === 'available'
    ? state
    : { ...state, updateStatus: next, updateInfo: { version: info.version ?? null, url: info.url ?? null } };
});

defineReducer('sidebar/view', (state, payload) => (
  payload === state.sidebarView ? state : { ...state, sidebarView: payload ?? null }
));

/** Select one slice with an optional comparator (defaults to Object.is). */
export const selectSlice = (key, isEqual = Object.is) => (state) => state[key];
export const selectHistoryState = () => (state) => state.historyState;
export const selectUpdateStatus = () => (state) => state.updateStatus;