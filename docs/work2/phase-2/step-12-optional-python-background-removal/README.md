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
	It supports global color-key and edge-connected flood-fill modes, explicit
	background colors, and bounded tolerance. It processes pixels in the browser, chunks work so it can observe
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
	only after explicit confirmation. Users can re-preview after changing mode,
	tolerance, color, or manual keep/remove rectangles. The preview can be
	expanded and its pointer capture is isolated from the editor canvas. Whole-canvas, active selection, and floating pasted
	selection inputs
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

## Future advanced segmentation plan (blueprint reconciliation)

The supplied offline-first AI-segmentation blueprint is now the planned
advanced-provider direction. It is planning input only; it does not authorize
shipping a model or runtime in the current release.

### Target architecture

- Keep the current `BackgroundRemovalProvider` and
  `BackgroundRemovalController` contracts as the integration seam. The future
  provider should be a factory-backed adapter, not a global singleton, so it
  can be enabled, cancelled, and destroyed per dialog/document.
- Isolate the optional implementation under a dedicated, removable module
  area (for example `js/background/ai-segmentation/`) containing the lazy UI
  adapter, a dedicated module Worker, self-hosted ONNX Runtime/WASM assets, and
  versioned model files. Do not add these bytes to the default editor graph.
- Load the adapter only after an explicit user choice with a privacy/runtime
  disclosure. A separate opt-in download/cache step may prepare the assets for
  offline use; the base service-worker shell must remain small.
- Use the existing preview overlay/mask editor for positive (keep) and
  negative (remove) clicks, zoom, expand, and pointer isolation. Clicks and
  overlays must never mutate the main canvas before Apply.

### Inference and safety work to complete later

1. Inspect the exact model graph before coding preprocessing. The blueprint's
   RGBA-to-planar-RGB conversion, normalized coordinates, tensor names, and
   output mask shape must match the selected model; do not assume a generic
   SAM encoder can consume clicks or return a final mask without its decoder.
2. Implement transferable, bounded Worker messages for image tiles, prompts,
   progress, mask previews, errors, and cancellation. Terminate the Worker on
   cancel, timeout, dialog close, document close, or provider failure.
3. Enforce the existing decoded-pixel, encoded-size, scratch-memory, and
   wall-clock limits before allocating tensors. Add device capability checks
   for WebGPU/WASM fallback and a clear local-provider fallback when the model
   cannot run.
4. Apply the accepted mask through the normal history/document/persistence
   boundary, preserving one forced undo snapshot and releasing ImageData,
   ImageBitmap, Blob, object URLs, and Worker resources.
5. Add fixtures for positive/negative prompts, repeated previews, transparent
   input, large-image rejection, cancellation, timeout, model-load failure,
   offline asset absence, undo/redo, and reload/recovery. Prove normal drawing
   and PNG export are unchanged when the advanced provider is disabled.

### Delivery gates

- No remote fetch or implicit image upload; every runtime/model asset is
  repository-hosted, versioned, and covered by an explicit privacy decision.
- The default local color-key/flood-fill workflow remains fully functional with
  zero model download and no regression to startup or mobile performance.
- Worker/model bundle size, peak memory, latency, cancellation behavior, and
  offline cache cost are measured on supported desktop and mobile devices
  before enabling the feature by default.
- The blueprint's `applyExtraction()` concept maps to the controller's normal
  Apply path; it must not write pixels directly without history and recovery
  integration.

## Done when

The accessible editor flow can use the local fallback without network access;
an advanced provider remains optional, explicitly disclosed, and safe to
disable without affecting normal drawing or PNG export.
