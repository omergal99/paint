# Paint Online accessibility patterns

## Native controls first

Use `<button>`, `<a href>`, `<input>`, `<select>`, and `<textarea>` where they
match the behavior. Do not add a keyboard handler to a native button that would
double-trigger Enter/Space.

```html
<button type="button" aria-label="Delete history image">🗑</button>
<label for="resize-percent">Scale (%)</label>
<input id="resize-percent" type="number" min="1" max="1000">
```

## Dialog close and focus

Prefer the native `<dialog>` already used by Paint. On close, restore focus to
the trigger. Keep Escape and the visible footer/header close actions working.

## Menus

Menu triggers expose an accessible name and `aria-expanded`. Menu items are
native buttons with `role="menuitem"` only when the container is a real menu.
Escape closes the menu; clicking outside closes it; clicks inside do not close a
menu that intentionally stays open, such as the shape gallery.

## Tabs

```html
<div role="tablist" aria-label="History views">
  <button role="tab" aria-selected="true" aria-controls="history-panel">History</button>
  <button role="tab" aria-selected="false" aria-controls="session-panel" tabindex="-1">Session</button>
</div>
<section id="history-panel" role="tabpanel" aria-labelledby="history-tab"></section>
```

Arrow keys move focus between tabs; the active tab has `tabindex="0"` and
inactive tabs use `tabindex="-1"`.

## Forms and errors

Associate labels explicitly. Add `aria-invalid="true"` and
`aria-describedby` for invalid resize values, storage failures, or unavailable
optional providers. The message must explain how to recover.

## Live status

```html
<div id="status-live" role="status" aria-live="polite" aria-atomic="true"></div>
```

Clear before writing the same message again so assistive technology can announce
repeated actions such as “History item deleted”. Use assertive alerts only for
data-loss or blocking errors.

## Dragging alternatives

Canvas resizing and selection moving need a non-drag path where practical:
numeric width/height/percentage fields, arrow-key nudges, or explicit action
buttons. A drag-only feature is not complete.

## Motion and reveal mode

The editable-text reveal effect must stop or shorten under
`prefers-reduced-motion: reduce`; the text regions must remain available without
animation.
