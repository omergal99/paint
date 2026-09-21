# Paint Online WCAG 2.2 reference

This is a focused checklist for the editor, not a full WCAG catalog.

## Level A - required baseline

| Criterion | Paint application |
|---|---|
| 1.1.1 Non-text Content | Meaningful images and icon controls have text alternatives/names. |
| 1.3.1 Info and Relationships | Labels, tab panels, headings, and status relationships are programmatic. |
| 1.4.1 Use of Color | Active/error/transparent states also have text, shape, icon, or state attributes. |
| 2.1.1 Keyboard | Ribbon, menus, settings, history, dialogs, and text editor work by keyboard. |
| 2.1.2 No Keyboard Trap | Focus can leave every menu, dialog, editor, and panel. |
| 2.1.4 Character Key Shortcuts | Single-key paint shortcuts do not hijack text/form editing. |
| 2.4.2 Page Titled | The editor has a descriptive document title. |
| 2.4.3 Focus Order | Focus order follows the visible workflow. |
| 2.5.1 Pointer Gestures | Pointer actions have single-pointer or control alternatives. |
| 3.1.1 Language | HTML declares its default language. |
| 3.3.1 Error Identification | Invalid resize/storage/provider states are described. |
| 3.3.2 Labels or Instructions | Every form control has a label/instruction. |
| 4.1.2 Name, Role, Value | Custom tabs, menus, buttons, and controls expose correct state. |
| 4.1.3 Status Messages | Save/delete/restore/errors are announced without moving focus. |

## Level AA - launch target

| Criterion | Paint application |
|---|---|
| 1.4.3 Contrast | Normal text is at least 4.5:1; large text at least 3:1. |
| 1.4.4 Resize Text | UI remains usable at 200% browser text/zoom where the canvas permits. |
| 1.4.10 Reflow | Narrow layouts do not hide essential controls behind undiscoverable overflow. |
| 1.4.11 Non-text Contrast | Focus, borders, selected tabs, and controls reach 3:1. |
| 2.4.6 Headings and Labels | Settings, sidebar, menus, and dialogs use descriptive labels. |
| 2.4.7 Focus Visible | Keyboard focus is visible in both themes. |
| 2.4.11 Focus Not Obscured | Ribbon/sidebar/dialog overlays do not hide focused controls. |
| 2.5.7 Dragging Movements | Resize, selection, ribbon, and split actions have alternatives. |
| 2.5.8 Target Size | Controls meet the 24×24 minimum; compact controls are reviewed manually. |
| 3.3.3 Error Suggestion | Invalid values explain acceptable ranges or recovery. |
| 3.3.4 Error Prevention | Destructive operations are confirmed or reversible. |

## Test evidence

Automated: Lighthouse accessibility and optional axe. Manual: keyboard-only
journeys, 200% zoom, reduced motion, light/dark themes, and at least one screen
reader check when available.
