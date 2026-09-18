# Step 12 — Optional Advanced Python Background Removal

## Goal

Offer advanced removal without making the default online editor heavy or
silently uploading private images.

## Tasks

- Define a cancellable background-removal provider interface.
- Keep browser color-key/alpha removal as the default.
- Compare Pyodide/WebAssembly, optional local Python service, and remote API on
  bundle size, memory, privacy, latency, and deployment effort.
- Add explicit progress, timeout, size limits, cancellation, and failure UX.

## Done when

The owner chooses a deployment model and the provider can be disabled without
affecting normal drawing or PNG export.

