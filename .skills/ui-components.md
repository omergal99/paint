# UI component skill

- Build components from a stable state contract plus render/bind functions.
- Make layout container-aware: use flex/grid, min/max constraints, and scroll.
- Keep keyboard focus, Escape, disabled, loading, and error states intentional.
- Use app dialogs/toasts and design tokens; never use native alert/confirm/prompt.
- Every menu item, submenu entry, and mirrored section gets a relevant decorative icon; keep visible text as the accessible name.
- Build dialogs with `standardizeDialogFrame` from `js/ui/DialogFrame.js`: titled header with `settings-close`, scrollable body, and bordered action footer.
- Keep components reusable: avoid feature-specific selectors inside generic code.
- Persist only through the owning data module and emit a named change event.
- Test both the default top layout and every docked/mobile layout that can change sizing.
