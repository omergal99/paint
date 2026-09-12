// Provider-neutral connection preferences. This intentionally stores only the
// selected provider and local connection state; provider secrets belong to a
// dedicated auth flow and must never be placed in the canvas settings object.

export const AI_PROVIDERS = Object.freeze([
  { id: 'local', label: 'Local deterministic actions' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'google', label: 'Google' },
]);

const DEFAULT_STATE = Object.freeze({ provider: 'local', connected: true });
const validProvider = (provider) => AI_PROVIDERS.some((item) => item.id === provider);

export function createAiConnectionStore({ storage = globalThis.localStorage, storageKey = 'paint:ai-connection' } = {}) {
  let state = { ...DEFAULT_STATE };

  try {
    const saved = JSON.parse(storage?.getItem(storageKey) || 'null');
    if (saved && validProvider(saved.provider)) {
      state = {
        provider: saved.provider,
        connected: saved.provider === 'local' && saved.connected === true,
      };
    }
  } catch {}

  const persist = () => {
    try { storage?.setItem(storageKey, JSON.stringify(state)); } catch {}
  };

  return {
    getState: () => ({ ...state }),
    setProvider(provider) {
      if (!validProvider(provider)) return { ...state };
      state = { provider, connected: provider === 'local' };
      persist();
      return { ...state };
    },
    setConnected(connected) {
      state = { ...state, connected: state.provider === 'local' && Boolean(connected) };
      persist();
      return { ...state };
    },
    reset() {
      state = { ...DEFAULT_STATE };
      persist();
      return { ...state };
    },
  };
}

