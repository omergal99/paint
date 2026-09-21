# Background-removal provider boundary

The base editor should construct a local fallback with
`createLocalColorKeyProvider()` and pass it to `createBackgroundRemovalService`.
The service accepts the documented contract:

```js
provider.inspectInput(imageBlob, signal) // -> { width, height }
provider.remove(imageBlob, options, signal, onProgress) // -> result
```

`service.remove(imageBlob, options, signal)` always resolves to a bounded
result. It checks encoded size, decoded dimensions/pixels, estimated temporary
working memory, cancellation, and one wall-clock timeout. A successful result
has `{ ok: true, imageBlob, width, height }`; a failed result has
`{ ok: false, error: { code, message, retryable } }`.

The local provider is browser-only and never calls a network API. The advanced
loader has no default importer. An integration point must deliberately supply a
self-hosted relative dynamic importer and call it only with
`explicitOptIn: true`. Remote providers additionally declare
`privacy.uploadsImage: true`; the service rejects them until the caller passes
`allowImageUpload: true`.

The editor integration is `BackgroundRemovalController.js`. It owns the
cancellable dialog, progress/preview state, and object-URL cleanup; callers
own the image source and Apply mutation so history and persistence stay at the
composition boundary. The default Crop → Remove Background action uses only
the local provider and does not load the advanced importer.

Future advanced providers must run their runtime/model in a dedicated Worker,
report progress, honour the supplied `AbortSignal`, terminate on timeout, and
keep runtime/model assets versioned and self-hosted. This boundary contains no
model, Python runtime, Worker, fetch, or upload code.
