# Step 12 - Optional Advanced Python Background Removal

## Current status

The reusable background-removal foundation is implemented and now connected to
a visible local editor workflow. The step is not fully launch-complete until
large-image/error journeys and the optional advanced-provider policy are
validated.

## Implemented foundation

- `js/background/BackgroundRemovalProvider.js` defines a provider-neutral,
  cancellable service that returns structured success or failure results rather
  than throwing into the editor.
- The service admits encoded size, decoded dimensions/pixels, estimated working
  memory, cancellation, and a bounded wall-clock timeout before or during work.
- `js/background/LocalColorKeyProvider.js` supplies the default local fallback.
  It processes pixels in the browser, chunks work so it can observe
  cancellation/progress, returns a PNG `Blob`, and does not fetch, create a
  Worker, or upload image bytes.
- `js/background/AdvancedProviderLoader.js` is inert by default. It will load
  only an injected relative/self-hosted dynamic module after an explicit
  advanced-provider opt-in. A remote provider must additionally declare its
  privacy behavior and receive explicit upload consent from its caller.
- No Python runtime, model, remote API, Worker, or upload path ships in the
  base editor. The provider boundary therefore cannot make normal drawing or
  PNG export download an optional runtime.
- The Crop → Remove Background action now opens a cancellable progress dialog,
  shows a checkerboard preview, discloses local-only processing, and applies
  only after explicit confirmation. Whole-canvas and active-selection inputs
  share the same provider contract; Apply takes a forced undo snapshot first.
- `tests/background-provider.test.js` covers admission limits, timeout and
  abort behavior, local color-key output/cleanup, and opt-in-only advanced
  loading.

## Still required to finish the feature

- Add an explicit optional advanced-provider choice and privacy/consent copy;
  the default local workflow is now complete for this slice.
- Add accessible progress, cancel, timeout, retry, and failure states. The UI
  must show a clear privacy/runtime disclosure before an advanced provider is
  loaded and a separate consent step before any remote upload.
- Choose and implement an advanced deployment model. If one is adopted, its
  model/runtime must be versioned and self-hosted, run in a dedicated Worker,
  honour cancellation, and meet memory/performance budgets on supported
  devices.
- Connect input/output handling to image admission, document persistence,
  history cleanup, and recovery; then exercise local, quota, cancellation, and
  large-image journeys in a real browser.

## Done when

The accessible editor flow can use the local fallback without network access;
an advanced provider remains optional, explicitly disclosed, and safe to
disable without affecting normal drawing or PNG export.
