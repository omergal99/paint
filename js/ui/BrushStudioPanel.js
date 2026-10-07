import { BUILT_IN_BRUSH_PRESETS } from '../tools/BrushState.js';
import { createBrushStrokeRenderer } from '../tools/BrushStrokeRenderer.js';
import { BRUSH_EXAMPLE_GRIDS, brushExampleInputValue, brushExampleValueLabel } from '../tools/BrushExamples.js';
import { hexToHsl, withSaturation, withLightness } from '../utils/color.js';
import { t } from '../i18n/messages.js';

const RANGE_FIELDS = Object.freeze([
	{ field: 'size', min: 1, max: 300, scale: 1, unit: 'px', label: 'ui.brushSize' },
	{ field: 'alpha', min: 0, max: 100, scale: 100, unit: '%', label: 'ui.brushOpacity' },
	{ field: 'flow', min: 0, max: 100, scale: 100, unit: '%', label: 'ui.brushFlow' },
	{ field: 'hardness', min: 0, max: 100, scale: 100, unit: '%', label: 'ui.brushHardness' },
	{ field: 'spacing', min: 5, max: 200, scale: 100, unit: '%', label: 'ui.brushSpacing' },
	{ field: 'stabilizer', min: 0, max: 100, scale: 100, unit: '%', label: 'ui.brushStabilizer' },
	{ field: 'roundness', min: 5, max: 100, scale: 100, unit: '%', label: 'ui.brushRoundness' },
	{ field: 'angle', min: 0, max: 360, scale: 1, unit: '°', label: 'ui.brushAngle' },
	{ field: 'angleJitter', min: 0, max: 100, scale: 100, unit: '%', label: 'ui.brushAngleJitter' },
	{ field: 'scatter', min: 0, max: 100, scale: 100, unit: '%', label: 'ui.brushScatter' },
	{ field: 'texture', min: 0, max: 100, scale: 100, unit: '%', label: 'ui.brushTexture' },
]);

const makeBrushIcon = (shape) => {
	const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	icon.setAttribute('viewBox', '0 0 20 20');
	icon.setAttribute('class', 'icon size4');
	icon.setAttribute('aria-hidden', 'true');
	const element = document.createElementNS('http://www.w3.org/2000/svg', shape === 'round' || shape === 'soft' ? 'circle' : 'rect');
	if (shape === 'round' || shape === 'soft') {
		element.setAttribute('cx', '10');
		element.setAttribute('cy', '10');
		element.setAttribute('r', shape === 'soft' ? '7' : '5');
	} else {
		element.setAttribute('x', '4');
		element.setAttribute('y', '4');
		element.setAttribute('width', '12');
		element.setAttribute('height', '12');
		if (shape === 'diamond') element.setAttribute('transform', 'rotate(45 10 10)');
	}
	element.setAttribute('fill', shape === 'soft' ? 'currentColor' : 'none');
	element.setAttribute('stroke', 'currentColor');
	icon.append(element);
	return icon;
};

const makeRenameIcon = () => {
	const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	icon.setAttribute('viewBox', '0 0 20 20');
	icon.setAttribute('class', 'icon size4');
	icon.setAttribute('aria-hidden', 'true');
	const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
	path.setAttribute('d', 'm3 14.5-.8 3.3 3.3-.8L16 7.5 12.5 4 3 14.5Zm8.5-9 3.5 3.5');
	path.setAttribute('fill', 'none');
	path.setAttribute('stroke', 'currentColor');
	path.setAttribute('stroke-linecap', 'round');
	path.setAttribute('stroke-linejoin', 'round');
	icon.append(path);
	return icon;
};

const fieldLabel = (key) => {
	const label = document.createElement('label');
	label.dataset.brushI18n = key;
	label.textContent = t(key);
	return label;
};

export const createBrushStudioPanel = ({ brushState, getPrimaryColor, setPrimaryColor, getPalette } = {}) => ({
	kind: 'custom',
	mount(host) {
		host.classList.add('brush-studio');
		host.dataset.tag = 'sidebar-mirror-brush-studio';

		const preview = document.createElement('canvas');
		preview.width = 260;
		preview.height = 54;
		preview.className = 'brush-studio-preview';
		preview.setAttribute('role', 'img');
		preview.setAttribute('aria-label', t('ui.brushStrokePreview'));
		host.append(preview);

		const controls = document.createElement('div');
		controls.className = 'brush-studio-controls';
		RANGE_FIELDS.forEach(({ field, min, max, scale, unit, label: labelKey }) => {
			const row = document.createElement('div');
			row.className = 'brush-studio-control';
			const label = fieldLabel(labelKey);
			const output = document.createElement('output');
			output.dataset.brushValue = field;
			const input = document.createElement('input');
			input.id = `brush-studio-${field}`;
			input.type = 'range';
			input.min = String(min);
			input.max = String(max);
			input.step = field === 'size' ? '1' : '1';
			input.dataset.brushControl = field;
			input.dataset.tag = `brush-studio-${field}`;
			label.htmlFor = input.id;
			input.setAttribute('aria-label', t(labelKey));
			row.append(label, output, input);
			controls.append(row);
		});
		host.append(controls);

		const tipSection = document.createElement('fieldset');
		tipSection.className = 'brush-studio-choice-group';
		const tipLegend = document.createElement('legend');
		tipLegend.dataset.brushI18n = 'ui.brushTipShape';
		tipLegend.textContent = t('ui.brushTipShape');
		const tipChoices = document.createElement('div');
		tipChoices.className = 'brush-studio-tip-choices';
		['round', 'soft', 'square', 'diamond'].forEach((shape) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'brush-studio-tip';
			button.dataset.brushTip = shape;
			button.title = t(`ui.brushTip${shape[0].toUpperCase()}${shape.slice(1)}`);
			button.dataset.brushI18nTitle = `ui.brushTip${shape[0].toUpperCase()}${shape.slice(1)}`;
			button.setAttribute('aria-label', button.title);
			button.append(makeBrushIcon(shape));
			tipChoices.append(button);
		});
		tipSection.append(tipLegend, tipChoices);
		// Per-stamp tip picking previews like any other advanced option: the
		// renderer walks BRUSH_TIP_OPTIONS when this is on.
		const randomShapeRow = document.createElement('label');
		randomShapeRow.className = 'brush-studio-check';
		const randomShapeInput = document.createElement('input');
		randomShapeInput.type = 'checkbox';
		randomShapeInput.dataset.brushRandomShape = '';
		randomShapeInput.dataset.tag = 'brush-studio-random-shape';
		const randomShapeText = document.createElement('span');
		randomShapeText.dataset.brushI18n = 'ui.brushRandomShape';
		randomShapeText.textContent = t('ui.brushRandomShape');
		randomShapeRow.append(randomShapeInput, randomShapeText);
		host.append(tipSection, randomShapeRow);

		const dynamics = document.createElement('div');
		dynamics.className = 'brush-studio-dynamics';
		[
			['pressureSize', 'ui.brushPressureSize'],
			['pressureFlow', 'ui.brushPressureFlow'],
		].forEach(([field, labelKey]) => {
			const label = document.createElement('label');
			label.className = 'brush-studio-check';
			const input = document.createElement('input');
			input.type = 'checkbox';
			input.dataset.brushDynamic = field;
			input.dataset.tag = `brush-studio-dynamics-${field}`;
			const text = document.createElement('span');
			text.dataset.brushI18n = labelKey;
			text.textContent = t(labelKey);
			label.append(input, text);
			dynamics.append(label);
		});
		[
			['speedSize', 'ui.brushSpeedSize'],
			['speedFlow', 'ui.brushSpeedFlow'],
		].forEach(([field, labelKey]) => {
			const row = document.createElement('label');
			row.className = 'brush-studio-dynamic-range';
			const text = document.createElement('span');
			text.textContent = t(labelKey);
			const output = document.createElement('output');
			output.dataset.brushValue = field;
			const input = document.createElement('input');
			input.type = 'range';
			input.min = '0';
			input.max = '100';
			input.dataset.brushDynamic = field;
			input.dataset.tag = `brush-studio-dynamics-${field}`;
			row.append(text, output, input);
			dynamics.append(row);
		});
		host.append(dynamics);

		const examplesSection = document.createElement('section');
		examplesSection.className = 'brush-studio-examples';
		examplesSection.dataset.tag = 'dom-section-brush-studio-examples';
		const examplesHeading = document.createElement('h4');
		examplesHeading.dataset.brushI18n = 'ui.brushExamples';
		examplesHeading.textContent = t('ui.brushExamples');
		examplesSection.append(examplesHeading);
		const exampleRows = new Map();
		BRUSH_EXAMPLE_GRIDS.forEach((grid) => {
			const row = document.createElement('div');
			row.className = 'brush-studio-example-row';
			row.dataset.tag = `brush-example-${grid.id}`;
			// Numeric rows show the live value in a number input first, then the
			// quick buttons; mode rows (blend/colour mode) stay button-only.
			const numeric = grid.kind === 'color'
				|| (grid.kind === 'brush' && !['blendMode', 'colorMode'].includes(grid.field));
			const head = document.createElement('div');
			head.className = 'brush-studio-example-head';
			const label = document.createElement(numeric ? 'label' : 'span');
			label.className = 'brush-studio-example-label';
			label.dataset.brushI18n = grid.labelKey;
			label.textContent = t(grid.labelKey);
			let numberInput = null;
			if (numeric) {
				numberInput = document.createElement('input');
				numberInput.type = 'number';
				numberInput.id = `brush-example-value-${grid.id}`;
				numberInput.dataset.brushExampleInput = grid.id;
				numberInput.dataset.tag = `brush-example-input-${grid.id}`;
				numberInput.min = String(grid.id === 'size' ? 1 : 0);
				numberInput.max = String(grid.id === 'size' ? 300 : 100);
				numberInput.step = '1';
				numberInput.setAttribute('aria-label', t(grid.labelKey));
				label.htmlFor = numberInput.id;
				head.append(label, numberInput);
			} else {
				head.append(label);
			}
			const values = document.createElement('div');
			values.className = 'brush-example-values';
			grid.values.forEach((value) => {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'brush-example';
				button.dataset.brushExample = grid.id;
				button.dataset.brushExampleValue = String(value);
				const resolved = brushExampleValueLabel(grid, value);
				const text = resolved.labelKey ? t(resolved.labelKey) : resolved.text;
				button.textContent = text;
				button.title = text;
				button.setAttribute('aria-label', `${t(grid.labelKey)}: ${text}`);
				if (grid.kind === 'color') button.classList.add('brush-example-color');
				values.append(button);
			});
			row.append(head, values);
			examplesSection.append(row);
			exampleRows.set(grid.id, { grid, values, input: numberInput });
		});
		host.append(examplesSection);

		// Stamp colours: select several palette colours here, then choose how
		// each stamp uses them with the colour-mode example row (random/series).
		const stampColorsSection = document.createElement('section');
		stampColorsSection.className = 'brush-studio-stamp-colors';
		const stampColorsHeading = document.createElement('h4');
		stampColorsHeading.dataset.brushI18n = 'ui.brushStampColors';
		stampColorsHeading.textContent = t('ui.brushStampColors');
		const colorChips = document.createElement('div');
		colorChips.className = 'brush-color-chips';
		stampColorsSection.append(stampColorsHeading, colorChips);
		const renderColorChips = () => {
			const selected = new Set(brushState.get().colors);
			colorChips.replaceChildren();
			(getPalette?.() || []).forEach((hex) => {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'brush-color-chip';
				button.dataset.brushColor = hex;
				button.style.background = hex;
				button.title = hex;
				button.setAttribute('aria-label', `Palette color ${hex}`);
				const active = selected.has(hex);
				button.classList.toggle('active', active);
				button.setAttribute('aria-pressed', String(active));
				colorChips.append(button);
			});
		};
		const syncColorChips = (state) => {
			const selected = new Set(state.colors || []);
			colorChips.querySelectorAll('[data-brush-color]').forEach((chip) => {
				const active = selected.has(chip.dataset.brushColor);
				chip.classList.toggle('active', active);
				chip.setAttribute('aria-pressed', String(active));
			});
		};
		renderColorChips();
		host.append(stampColorsSection);

		const refreshExampleColors = () => {
			const base = getPrimaryColor?.() || '#000000';
			exampleRows.forEach(({ grid, values }) => {
				if (grid.kind !== 'color') return;
				values.querySelectorAll('[data-brush-example]').forEach((button) => {
					const value = Number(button.dataset.brushExampleValue);
					const hex = grid.transform === 'saturation'
						? withSaturation(base, value)
						: withLightness(base, value);
					button.dataset.brushExampleColor = hex;
					button.style.background = hex;
				});
			});
		};

		const presetSection = document.createElement('section');
		presetSection.className = 'brush-studio-presets';
		const presetHeading = document.createElement('h4');
		presetHeading.dataset.brushI18n = 'ui.brushPresets';
		presetHeading.textContent = t('ui.brushPresets');
		const presetButtons = document.createElement('div');
		presetButtons.className = 'brush-studio-preset-buttons';
		BUILT_IN_BRUSH_PRESETS.forEach((preset) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'brush-studio-preset';
			button.dataset.brushPreset = preset.id;
			button.append(makeBrushIcon(preset.tipShape));
			const name = document.createElement('span');
			name.textContent = t(`ui.brushPreset${preset.id.replace(/(^|-)([a-z])/g, (_, _dash, letter) => letter.toUpperCase())}`);
			name.dataset.brushI18n = `ui.brushPreset${preset.id.replace(/(^|-)([a-z])/g, (_, _dash, letter) => letter.toUpperCase())}`;
			button.append(name);
			presetButtons.append(button);
		});
		const savePreset = document.createElement('button');
		savePreset.type = 'button';
		savePreset.className = 'brush-studio-save-preset';
		savePreset.dataset.brushI18n = 'ui.brushSavePreset';
		savePreset.textContent = t('ui.brushSavePreset');
		presetSection.append(presetHeading, presetButtons, savePreset);
		host.append(presetSection);

		const customPresets = document.createElement('div');
		customPresets.className = 'brush-studio-custom-presets';
		presetSection.append(customPresets);

		const historySection = document.createElement('section');
		historySection.className = 'brush-studio-history';
		const historyHeading = document.createElement('h4');
		historyHeading.dataset.brushI18n = 'ui.brushHistory';
		historyHeading.textContent = t('ui.brushHistory');
		const historyButtons = document.createElement('div');
		historyButtons.className = 'brush-studio-history-buttons';
		historySection.append(historyHeading, historyButtons);
		host.append(historySection);

		const updatePresetAndHistory = (state) => {
			customPresets.replaceChildren();
			(state.presets || []).forEach((preset) => {
				const group = document.createElement('div');
				group.className = 'brush-studio-custom-preset';
				group.dataset.tag = 'brush-preset-card';
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'brush-studio-preset';
				button.dataset.brushCustomPreset = preset.id;
				button.dataset.tag = 'brush-preset-apply';
				button.setAttribute('aria-label', preset.name);
				button.title = preset.name;
				button.append(makeBrushIcon(preset.tipShape || 'round'));
				const label = document.createElement('span');
				label.textContent = preset.name;
				label.title = preset.name;
				label.dataset.tag = 'brush-preset-name';
				button.append(label);
				const rename = document.createElement('button');
				rename.type = 'button';
				rename.className = 'brush-studio-rename-preset';
				rename.dataset.tag = 'brush-preset-rename';
				rename.setAttribute('aria-label', t('common.actions.rename'));
				rename.title = t('common.actions.rename');
				rename.append(makeRenameIcon());
				const nameInput = document.createElement('input');
				nameInput.type = 'text';
				nameInput.className = 'brush-studio-preset-name-input';
				nameInput.value = preset.name;
				nameInput.maxLength = 40;
				nameInput.hidden = true;
				nameInput.dataset.tag = 'brush-preset-name-input';
				nameInput.setAttribute('aria-label', t('common.actions.rename'));
				const remove = document.createElement('button');
				remove.type = 'button';
				remove.className = 'brush-studio-delete-preset';
				remove.dataset.brushDeletePreset = preset.id;
				remove.dataset.tag = 'brush-preset-delete';
				remove.setAttribute('aria-label', t('common.actions.delete'));
				remove.title = t('common.actions.delete');
				remove.textContent = '×';
				group.append(button, rename, nameInput, remove);
				customPresets.append(group);
			});
			historyButtons.replaceChildren();
			(state.history || []).slice(0, 8).forEach((entry, index) => {
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'brush-studio-history-chip';
				button.dataset.brushHistory = String(index);
				button.style.setProperty('--brush-history-color', entry.color || '#000000');
				button.title = t('ui.brushHistoryTooltip', {
					size: entry.size,
					opacity: Math.round((entry.alpha || 0) * 100),
				});
				button.setAttribute('aria-label', button.title);
				button.append(makeBrushIcon(entry.tipShape || 'round'));
				historyButtons.append(button);
			});
		};

		let latestState = brushState.get();
		const update = (state) => {
			latestState = state;
			RANGE_FIELDS.forEach(({ field, scale, unit }) => {
				const input = controls.querySelector(`[data-brush-control="${field}"]`);
				const output = host.querySelector(`[data-brush-value="${field}"]`);
				const value = Math.round((state[field] || 0) * scale);
				if (input) input.value = String(value);
				if (output) output.value = `${value}${unit}`;
			});
			host.querySelectorAll('[data-brush-tip]').forEach((button) => {
				const selected = button.dataset.brushTip === state.tipShape;
				button.classList.toggle('active', selected);
				button.setAttribute('aria-pressed', String(selected));
			});
			host.querySelectorAll('[data-brush-dynamic]').forEach((input) => {
				const field = input.dataset.brushDynamic;
				const value = state.dynamics?.[field] ?? 0;
				if (input.type === 'checkbox') input.checked = Boolean(value);
				else {
					input.value = String(Math.round(value * 100));
					const output = host.querySelector(`[data-brush-value="${field}"]`);
					if (output) output.value = `${Math.round(value * 100)}%`;
				}
			});
			host.querySelectorAll('[data-brush-random-shape]').forEach((input) => {
				input.checked = Boolean(state.randomShape);
			});
			// Example rows: colour rows reflect the current primary's saturation/
			// lightness (so the active chip reads as selected), brush rows reflect
			// the state, and the number input always shows the live value.
			const primaryHsl = hexToHsl(getPrimaryColor?.() || '');
			exampleRows.forEach(({ grid, values, input }) => {
				if (grid.kind === 'color') {
					const current = primaryHsl
						? (grid.transform === 'saturation' ? primaryHsl.s : primaryHsl.l)
						: null;
					if (input && current !== null && document.activeElement !== input) {
						input.value = String(current);
					}
					values.querySelectorAll('[data-brush-example]').forEach((button) => {
						const matches = current !== null
							&& Number(button.dataset.brushExampleValue) === current;
						button.classList.toggle('active', matches);
						button.setAttribute('aria-pressed', String(matches));
					});
					return;
				}
				if (input && document.activeElement !== input) {
					const display = grid.field === 'size'
						? Math.round(state[grid.field] || 0)
						: Math.round((state[grid.field] || 0) * 100);
					input.value = String(display);
				}
				values.querySelectorAll('[data-brush-example]').forEach((button) => {
					const raw = button.dataset.brushExampleValue;
					const matches = grid.field === 'blendMode' || grid.field === 'colorMode'
						? state[grid.field] === raw
						: Number(state[grid.field]) === Number(raw);
					button.classList.toggle('active', matches);
					button.setAttribute('aria-pressed', String(matches));
				});
			});
			syncColorChips(state);
			refreshExampleColors();
			updatePresetAndHistory(state);
			renderPreview(state);
		};

		const renderPreview = (state) => {
			const context = preview.getContext('2d');
			if (!context) return;
			context.clearRect(0, 0, preview.width, preview.height);
			const color = getPrimaryColor?.() || '#2563eb';
			const renderer = createBrushStrokeRenderer(context, {
				...state,
				size: Math.min(state.size, 20),
				spacing: Math.max(state.spacing, 0.1),
			}, { color, alpha: state.alpha });
			for (let x = 12; x <= 248; x += 4) {
				const y = 27 + Math.sin((x - 12) / 236 * Math.PI * 2) * 13;
				renderer.drawTo({ x, y });
			}
		};

		const presetPatch = (preset) => ({
			size: preset.size,
			alpha: preset.alpha,
			flow: preset.flow,
			hardness: preset.hardness,
			spacing: preset.spacing,
			tipShape: preset.tipShape,
			roundness: preset.roundness ?? 1,
			angle: preset.angle ?? 0,
			angleJitter: preset.angleJitter ?? 0,
			scatter: preset.scatter ?? 0,
			texture: preset.texture ?? 0,
			blendMode: preset.blendMode ?? 'normal',
			colorMode: preset.colorMode ?? 'single',
			colors: Array.isArray(preset.colors) ? preset.colors : [],
			randomShape: preset.randomShape ?? false,
		});

		const beginPresetRename = (group) => {
			const label = group?.querySelector('[data-tag="brush-preset-name"]');
			const input = group?.querySelector('.brush-studio-preset-name-input');
			if (!label || !input) return;
			label.hidden = true;
			input.hidden = false;
			input.value = label.textContent;
			input.focus();
			input.select();
		};
		const finishPresetRename = (input, commit) => {
			const group = input.closest('.brush-studio-custom-preset');
			const label = group?.querySelector('[data-tag="brush-preset-name"]');
			const applyButton = group?.querySelector('[data-brush-custom-preset]');
			if (!label || !applyButton) return;
			const name = input.value.trim().slice(0, input.maxLength);
			input.hidden = true;
			label.hidden = false;
			if (!commit || !name) {
				input.value = label.textContent;
				return;
			}
			if (name === label.textContent) return;
			brushState.set({
				presets: brushState.get().presets.map((preset) => (
					preset.id === applyButton.dataset.brushCustomPreset ? { ...preset, name } : preset
				)),
			});
		};

		host.addEventListener('input', (event) => {
			const input = event.target;
			if (input.matches?.('[data-brush-control]')) {
				const field = input.dataset.brushControl;
				const config = RANGE_FIELDS.find((entry) => entry.field === field);
				if (config) brushState.set({ [field]: Number(input.value) / config.scale });
				return;
			}
			if (input.matches?.('[data-brush-dynamic]')) {
				const field = input.dataset.brushDynamic;
				const value = input.type === 'checkbox' ? input.checked : Number(input.value) / 100;
				brushState.set({ dynamics: { ...brushState.get().dynamics, [field]: value } });
				return;
			}
			if (input.matches?.('[data-brush-random-shape]')) {
				brushState.set({ randomShape: input.checked });
			}
		});
		// Number inputs commit on change so clearing the field mid-edit does not
		// clamp the state on every keystroke.
		host.addEventListener('change', (event) => {
			const input = event.target;
			if (!input.matches?.('[data-brush-example-input]')) return;
			const grid = BRUSH_EXAMPLE_GRIDS.find((entry) => entry.id === input.dataset.brushExampleInput);
			if (!grid) return;
			const raw = Number(input.value);
			if (!Number.isFinite(raw)) return;
			if (grid.kind === 'color') {
				const base = getPrimaryColor?.() || '#000000';
				const value = Math.max(0, Math.min(100, Math.round(raw)));
				setPrimaryColor?.(grid.transform === 'saturation'
					? withSaturation(base, value)
					: withLightness(base, value));
				return;
			}
			brushState.set({ [grid.field]: grid.field === 'size' ? raw : raw / 100 });
		});
		host.addEventListener('keydown', (event) => {
			const input = event.target;
			if (!input.matches?.('.brush-studio-preset-name-input')) return;
			if (event.key === 'Enter') {
				event.preventDefault();
				finishPresetRename(input, true);
			} else if (event.key === 'Escape') {
				event.preventDefault();
				finishPresetRename(input, false);
			}
		});
		host.addEventListener('focusout', (event) => {
			const input = event.target;
			if (input.matches?.('.brush-studio-preset-name-input') && !input.hidden) {
				finishPresetRename(input, true);
			}
		});
		host.addEventListener('dblclick', (event) => {
			const label = event.target.closest?.('[data-tag="brush-preset-name"]');
			if (!label || !host.contains(label)) return;
			event.preventDefault();
			beginPresetRename(label.closest('.brush-studio-custom-preset'));
		});
		host.addEventListener('click', (event) => {
			const button = event.target.closest?.('button');
			if (!button || !host.contains(button)) return;
			if (button.classList.contains('brush-studio-rename-preset')) {
				beginPresetRename(button.closest('.brush-studio-custom-preset'));
				return;
			}
			if (button.dataset.brushColor) {
				const hex = button.dataset.brushColor;
				const colors = brushState.get().colors;
				const next = colors.includes(hex)
					? colors.filter((entry) => entry !== hex)
					: [...colors, hex];
				brushState.set({ colors: next });
				return;
			}
			if (button.dataset.brushExample) {
				const grid = BRUSH_EXAMPLE_GRIDS.find((entry) => entry.id === button.dataset.brushExample);
				if (!grid) return;
				if (grid.kind === 'color') {
					const hex = button.dataset.brushExampleColor;
					if (hex) setPrimaryColor?.(hex);
					return;
				}
				const raw = button.dataset.brushExampleValue;
				brushState.set({ [grid.field]: brushExampleInputValue(grid, raw) });
				return;
			}
			const preset = BUILT_IN_BRUSH_PRESETS.find((item) => item.id === button.dataset.brushPreset);
			if (preset) {
				brushState.set(presetPatch(preset));
				return;
			}
			if (button.dataset.brushTip) {
				brushState.set({ tipShape: button.dataset.brushTip });
				return;
			}
			if (button.classList.contains('brush-studio-save-preset')) {
				const state = brushState.get();
				const name = t('ui.brushCustomPreset', { number: state.presets.length + 1 });
				const custom = {
					id: `custom-${Date.now()}`,
					name,
					...presetPatch(state),
				};
				brushState.set({ presets: [custom, ...state.presets].slice(0, 20) });
				return;
			}
			if (button.dataset.brushDeletePreset) {
				brushState.set({
					presets: brushState.get().presets.filter((item) => item.id !== button.dataset.brushDeletePreset),
				});
				return;
			}
			if (button.dataset.brushCustomPreset) {
				const custom = brushState.get().presets.find((item) => item.id === button.dataset.brushCustomPreset);
				if (custom) brushState.set(presetPatch(custom));
				return;
			}
			if (button.dataset.brushHistory) {
				const entry = brushState.get().history[Number(button.dataset.brushHistory)];
				if (!entry) return;
				const { color, ...patch } = entry;
				brushState.set(patch);
				if (color) setPrimaryColor?.(color);
			}
		});
		const refreshLocale = () => {
			host.querySelectorAll('[data-brush-i18n]').forEach((node) => {
				node.textContent = t(node.dataset.brushI18n);
			});
			host.querySelectorAll('[data-brush-i18n-title]').forEach((node) => {
				const value = t(node.dataset.brushI18nTitle);
				node.title = value;
				node.setAttribute('aria-label', value);
			});
			preview.setAttribute('aria-label', t('ui.brushStrokePreview'));
			host.querySelectorAll('[data-brush-control]').forEach((input) => {
				const config = RANGE_FIELDS.find((entry) => entry.field === input.dataset.brushControl);
				if (config) input.setAttribute('aria-label', t(config.label));
			});
			host.querySelectorAll('[data-brush-example]').forEach((button) => {
				const grid = BRUSH_EXAMPLE_GRIDS.find((entry) => entry.id === button.dataset.brushExample);
				if (!grid) return;
				const resolved = brushExampleValueLabel(
					grid,
					grid.field === 'blendMode' || grid.field === 'colorMode'
						? button.dataset.brushExampleValue
						: Number(button.dataset.brushExampleValue),
				);
				const text = resolved.labelKey ? t(resolved.labelKey) : resolved.text;
				if (grid.kind === 'brush' && ['blendMode', 'colorMode'].includes(grid.field)) {
					button.textContent = text;
				}
				button.title = text;
				button.setAttribute('aria-label', `${t(grid.labelKey)}: ${text}`);
			});
			host.querySelectorAll('[data-brush-example-input]').forEach((input) => {
				const grid = BRUSH_EXAMPLE_GRIDS.find((entry) => entry.id === input.dataset.brushExampleInput);
				if (grid) input.setAttribute('aria-label', t(grid.labelKey));
			});
			update(latestState);
		};
		update(latestState);
		const unsubscribe = brushState.subscribe(update);
		window.addEventListener('paint:locale-change', refreshLocale);
		// The primary colour drives the colour-example chips and the preview, so
		// one update pass re-renders both (and their selected states).
		const refreshPreviewColor = () => update(latestState);
		window.addEventListener('paint:primary-color-change', refreshPreviewColor);
		// Palette edits (ribbon context menu, settings picker, presets) rebuild
		// the stamp-colour chips from the same source of truth.
		window.addEventListener('paint:palette-change', renderColorChips);
		return () => {
			unsubscribe();
			window.removeEventListener('paint:locale-change', refreshLocale);
			window.removeEventListener('paint:primary-color-change', refreshPreviewColor);
			window.removeEventListener('paint:palette-change', renderColorChips);
		};
	},
});
