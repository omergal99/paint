# AI integration plan

The current AI Chat panel is intentionally a local mock and is closed for new
users. Real provider connections should be added as an isolated feature rather
than making the canvas or `Sidebar` know provider-specific details.

## Proposed structure

```text
js/ai/
  AiAgentService.js       # provider-agnostic request/session interface
  AiContextBuilder.js      # prompt, current image, selection and metadata
  AiEditPipeline.js       # preview -> approve -> apply, with undo snapshot
  providers/
    OpenAiProvider.js
    AnthropicProvider.js
    GoogleProvider.js
  storage/
    AiConnectionStore.js   # provider, model and token metadata
```

`Sidebar` should talk only to `AiAgentService`. Providers implement one small
contract such as `sendMessage({ messages, image })` and return text plus an
optional image edit. `AiContextBuilder` should send the current canvas or
selection as an explicit, user-visible attachment and include dimensions and
the active selection—not hidden application state.

## Connection and safety rules

- Offer a provider picker for OpenAI, Anthropic and Google, followed by a
  provider-hosted login/OAuth flow where supported.
- Never put provider secrets in the repository or send them through a shared
  backend without an explicit server configuration. For direct browser API-key
  mode, warn that the key is stored locally and provide a delete button.
- Keep connection state in an `AiConnectionStore`, separate from canvas data;
  store only the minimum token/refresh-token material supported by the chosen
  auth flow.
- AI edits must render into a temporary preview/floating selection. `Apply`
  takes a normal history snapshot first; `Discard` must leave the canvas
  untouched.
- Add request cancellation, provider error states, usage limits and a clear
  “send current image” toggle. Do not upload the image merely by opening Chat.

## Delivery slices

1. Add the provider-neutral service contract and a fake provider for tests.
2. Add connection UI and persistence with no canvas mutation.
3. Add current-image/selection context preview and request cancellation.
4. Add image-result preview, Apply/Discard, and undo integration.
5. Add provider adapters one at a time, with capability detection and privacy
   copy for each provider.
