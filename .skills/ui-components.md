# UI component skill

- Build components from a stable state contract plus render/bind functions.
- Make layout container-aware: use flex/grid, min/max constraints, and scroll.
- Keep keyboard focus, Escape, disabled, loading, and error states intentional.
- Use app dialogs/toasts and design tokens; never use native alert/confirm/prompt.
- Keep components reusable: avoid feature-specific selectors inside generic code.
- Persist only through the owning data module and emit a named change event.
- Test both the default top layout and every docked/mobile layout that can change sizing.
