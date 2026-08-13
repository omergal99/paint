const CACHE_NAME = 'paint-shell-v1-1-4';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './css/styles.css',
  './js/app.js',
  './js/version.js',
  './js/main.js',
  './js/canvas.js',
  './js/storage.js',
  './js/telemetry.js',
  './js/tools.js',
  './js/canvas/CanvasManager.js',
  './js/canvas/CanvasResizer.js',
  './js/canvas/ViewportManager.js',
  './js/clipboard/ClipboardManager.js',
  './js/history/HistoryManager.js',
  './js/tools/ToolManager.js',
  './js/tools/FreehandTools.js',
  './js/tools/FillTool.js',
  './js/tools/ShapeTool.js',
  './js/tools/TextTool.js',
  './js/tools/EyedropperTool.js',
  './js/tools/ZoomTool.js',
  './js/tools/SelectTool.js',
  './js/ui/ColorPalette.js',
  './js/ui/ColorInspector.js',
  './js/ui/StatusBar.js',
  './js/ui/Toolbar.js',
  './js/ui/Sidebar.js',
  './js/utils/color.js',
  './js/utils/transform.js',
  './css/assets/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
