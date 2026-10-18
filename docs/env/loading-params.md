# URL Query Parameters — Debug Loading

This app is a static client-side ES module bundle. It does **not** read `.env`
files at runtime. Debug behaviour is controlled exclusively via URL query
parameters appended to the page URL.

## Parameters

| Parameter | Value | Effect |
|-----------|-------|--------|
| `debugLoading` | `1` | Enables the artificial startup loading delay. Any other value (or omitting the parameter) results in normal fast startup with no artificial delay. |
| `loadingMs` | Integer (ms) | Holds both the ribbon and canvas loading masks open for N milliseconds after they would normally be released. Capped at 10000 ms. Ignored unless `debugLoading=1`. |

## Examples

```
# Hold both loading masks open for 15 seconds to inspect the canvas jump:
http://127.0.0.1:5512/index.html?debugLoading=1&loadingMs=15000

# Hold both loading masks open for 2 seconds:
http://127.0.0.1:5512/index.html?debugLoading=1&loadingMs=2000

# Normal fast startup (production behaviour, no artificial delay):
http://127.0.0.1:5512/index.html
```

## Implementation

The parameters are read by `js/core/initAppLoadingService.js` via
`getDebugLoadingDelay()`. Both `js/app.js` (ribbon mask) and `js/main.js`
(canvas mask) import from this single module, so the delay is applied
uniformly across all startup masks.
