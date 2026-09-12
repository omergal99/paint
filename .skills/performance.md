# Performance skill

- Do not redraw or serialize the canvas on every pointer move unless required.
- Batch DOM/layout work; avoid forced layout inside move/scroll loops.
- Use ResizeObserver/requestAnimationFrame for resize-driven persistence.
- Keep image work bounded and preserve undo/history semantics.
- Lazy-load or isolate provider/network work; never upload an image merely by opening UI.
- Measure before optimizing, then validate behavior at small and large canvases.
