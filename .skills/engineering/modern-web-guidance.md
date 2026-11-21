# Modern Web Guidance: local principles

Reviewed 2026-11-21 against Google's
[Modern Web Guidance](https://developer.chrome.com/docs/modern-web-guidance/)
and [source repository](https://github.com/GoogleChrome/modern-web-guidance).
This is a short, original summary, not a copy of the upstream catalog. Check
the current source for detailed or fast-changing platform behavior.

- Prefer semantic HTML and built-in browser capabilities before custom
  abstractions; use native controls and dialogs when they fit the interaction.
- Choose Web APIs and CSS features based on the app's supported browsers.
  Check [Baseline](https://web.dev/baseline/) and provide progressive
  enhancement or a usable fallback when support is incomplete.
- Treat accessibility, security, and performance as design constraints, not
  post-release audit steps. Avoid layout work in hot paths and protect local
  image data from unnecessary network transfer.
- Measure the actual user journey. Pair static checks with browser evidence,
  and do not claim a score or metric proves behavior it did not measure.
- Apply guidance selectively: do not add a new API, polyfill, dependency, or
  agent plugin just because it is modern or appears in an upstream catalog.

For Paint, this is especially relevant to canvas, clipboard, dialogs, storage,
service workers, responsive layout, and keyboard-accessible controls.
