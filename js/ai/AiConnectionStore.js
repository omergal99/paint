// Provider-neutral launcher preferences. This intentionally stores only the
// selected external service; credentials remain on the provider's own site.

export const AI_PROVIDERS = Object.freeze([
  { id: 'local', label: 'Local deterministic actions' },
  { id: 'openai', label: 'ChatGPT', url: 'https://chatgpt.com/', imageSupport: true },
  { id: 'anthropic', label: 'Claude', url: 'https://claude.ai/', imageSupport: true },
  { id: 'google', label: 'Gemini / Nano Banana', url: 'https://gemini.google.com/', imageSupport: true },
]);

const DEFAULT_STATE = Object.freeze({ provider: 'local' });
const validProvider = (provider) => AI_PROVIDERS.some((item) => item.id === provider);
const publicState = (state) => ({
  provider: state.provider,
  connected: state.provider === 'local',
});

export function createAiConnectionStore({ storage = globalThis.localStorage, storageKey = 'paint:ai-connection' } = {}) {
  let state = { ...DEFAULT_STATE };
  let shouldCleanLegacyCredentials = false;

  try {
    const saved = JSON.parse(storage?.getItem(storageKey) || 'null');
    if (saved && validProvider(saved.provider)) {
      state = { provider: saved.provider };
      shouldCleanLegacyCredentials = saved.apiKeys != null;
    }
  } catch {}

  const persist = () => {
    try { storage?.setItem(storageKey, JSON.stringify(state)); } catch {}
  };
  if (shouldCleanLegacyCredentials) persist();

  return {
    getState: () => publicState(state),
    setProvider(provider) {
      if (!validProvider(provider)) return publicState(state);
      state = { ...state, provider };
      persist();
      return publicState(state);
    },
    reset() {
      state = { ...DEFAULT_STATE };
      persist();
      return publicState(state);
    },
  };
}
