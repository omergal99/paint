# Future Ideas 2

This file collects the next wave of improvements after the current paint and sidebar work.

## 1. PWA + Offline First
- Turn the app into a real installable PWA with a stronger offline story.
- Cache the shell, fonts, icons, and the last canvas state with a service worker.
- Add an update banner so users can reload when a new version is available.

## 2. Automatic Updates
- Detect when a new service worker is waiting.
- Show a small toast or banner with a `Reload` action instead of forcing a hard refresh.
- Keep the current canvas state safe before reloading.

## 3. Better Mobile Canvas UX
- Add a dedicated mobile view with larger touch targets and a simpler bottom toolbar.
- Make the canvas stage support full-screen drawing on phones and tablets.
- Add a vertical-only extend mode for quick sketching on narrow screens.

## 4. Image Import Flow
- Add drag-and-drop from the file system directly into the canvas as a floating image.
- Add a quick import button near `Open` and keep `Open` as a replace action.
- Support paste-like behavior for imported images so they can be moved immediately.

## 5. Selection Improvements
- Add rotate and resize handles around floating selections.
- Support corner dragging, edge dragging, and keyboard nudging with better touch parity.
- Add a visible selection toolbar for commit, cancel, duplicate, flip, and crop.

## 6. Sidebar Expansion
- Split the sidebar into tabs for history, settings, and AI actions.
- Add search and filter controls for history entries.
- Make the sidebar resizable on desktop and slide-over on mobile.

## 7. Safer Saving
- Add an explicit save status area so users can see when the file was written.
- Support `Save As` with friendly filenames and a recent-files list.
- Keep a lightweight local backup trail so work is recoverable after crashes.

## 8. Accessibility Pass
- Improve keyboard navigation across the ribbon and sidebar.
- Add more visible focus states and shortcut hints.
- Make selection and resize handles easier to reach with assistive input.

