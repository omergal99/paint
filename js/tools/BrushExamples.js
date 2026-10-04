import {
	BRUSH_BLEND_MODES,
	BRUSH_BLEND_MODE_IDS,
	BRUSH_COLOR_MODES,
	BRUSH_COLOR_MODE_IDS,
} from './BrushState.js';

// Phase 5 finalization - the owner's "example grids for used style/size/
// saturation/lightness/opacity/flow/texture/strength" request. One row per
// property; every value is a clickable example that writes the property.
//
// `kind: 'brush'` rows write `BrushState[field]` directly; `kind: 'color'` rows
// transform the current primary colour and write it through the palette, so the
// ribbon, sidebar, preview, and canvas stay in sync (one source of truth).
// The tip "style" row is intentionally absent: the studio already renders a tip
// chooser and one style surface is enough.
export const BRUSH_EXAMPLE_GRIDS = Object.freeze([
	Object.freeze({ id: 'size', labelKey: 'ui.brushSize', kind: 'brush', field: 'size', values: Object.freeze([2, 4, 8, 16, 32, 64]) }),
	Object.freeze({ id: 'alpha', labelKey: 'ui.brushOpacity', kind: 'brush', field: 'alpha', values: Object.freeze([0.25, 0.5, 0.75, 1]) }),
	Object.freeze({ id: 'flow', labelKey: 'ui.brushFlow', kind: 'brush', field: 'flow', values: Object.freeze([0.25, 0.5, 0.75, 1]) }),
	Object.freeze({ id: 'hardness', labelKey: 'ui.brushHardness', kind: 'brush', field: 'hardness', values: Object.freeze([0, 0.25, 0.5, 0.75, 1]) }),
	Object.freeze({ id: 'spacing', labelKey: 'ui.brushSpacing', kind: 'brush', field: 'spacing', values: Object.freeze([0.05, 0.1, 0.25, 0.5, 1]) }),
	Object.freeze({ id: 'texture', labelKey: 'ui.brushTexture', kind: 'brush', field: 'texture', values: Object.freeze([0, 0.25, 0.5, 0.75, 1]) }),
	Object.freeze({ id: 'scatter', labelKey: 'ui.brushScatter', kind: 'brush', field: 'scatter', values: Object.freeze([0, 0.25, 0.5, 0.75, 1]) }),
	Object.freeze({ id: 'blendMode', labelKey: 'ui.brushBlendMode', kind: 'brush', field: 'blendMode', values: BRUSH_BLEND_MODE_IDS }),
	Object.freeze({ id: 'colorMode', labelKey: 'ui.brushColorMode', kind: 'brush', field: 'colorMode', values: BRUSH_COLOR_MODE_IDS }),
	Object.freeze({ id: 'saturation', labelKey: 'ui.brushSaturation', kind: 'color', transform: 'saturation', values: Object.freeze([0, 30, 55, 80, 100]) }),
	Object.freeze({ id: 'lightness', labelKey: 'ui.brushLightness', kind: 'color', transform: 'lightness', values: Object.freeze([15, 35, 50, 70, 90]) }),
]);

// Resolve a readable label for one example value. Returns `{ text }` for
// px/percent rows and `{ labelKey }` for modes so the panel can translate it.
export const brushExampleValueLabel = (grid, value) => {
	if (grid.field === 'size') return { text: `${value} px` };
	if (grid.field === 'blendMode') {
		const mode = BRUSH_BLEND_MODES.find((entry) => entry.id === value);
		return { labelKey: mode ? mode.labelKey : value };
	}
	if (grid.field === 'colorMode') {
		const mode = BRUSH_COLOR_MODES.find((entry) => entry.id === value);
		return { labelKey: mode ? mode.labelKey : value };
	}
	// Colour rows already carry 0-100 percents; brush rows are normalised 0-1.
	if (grid.transform) return { text: `${Math.round(value)}%` };
	return { text: `${Math.round(value * 100)}%` };
};
