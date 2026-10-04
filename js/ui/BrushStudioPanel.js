import { BUILT_IN_BRUSH_PRESETS } from '../tools/BrushState.js';
import { createBrushStrokeRenderer } from '../tools/BrushStrokeRenderer.js';
import { t } from '../i18n/messages.js';

const RANGE_FIELDS = Object.freeze([
	{ field: 'size', min: 1, max: 300, scale: 1, unit: 'px', label: 'ui.brushSize' },
	{ field: 'alpha', min: 0, max: 100, scale: 100, unit: '%', label: 'ui.brushOpacity' },
	{ field: 'flow', min: 0, max: 100, scale: 100, unit: '%', label: 'ui.brushFlow' },
	{ field: 'hardness', min: 0, max: 100, scale: 100, unit: '%', label: 'ui.brushHardness' },
	{ field: 'spacing', min: 5, max: 200, scale: 100, unit: '%', label: 'ui.brushSpacing' },
	{ field: 'stabilizer', min: 0, max: 100, scale: 100, unit: '%', label: 'ui.brushStabilizer' },
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

const fieldLabel = (key) => {
	const label = document.createElement('label');
	label.dataset.brushI18n = key;
	label.textContent = t(key);
	return label;
};

export const createBrushStudioPanel = ({ brushState, getPrimaryColor, setPrimaryColor } = {}) => ({
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
		host.append(tipSection);

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
			row.append(text, output, input);
			dynamics.append(row);
		});
		host.append(dynamics);

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
				const button = document.createElement('button');
				button.type = 'button';
				button.className = 'brush-studio-preset';
				button.dataset.brushCustomPreset = preset.id;
				button.append(makeBrushIcon(preset.tipShape || 'round'));
				const label = document.createElement('span');
				label.textContent = preset.name;
				button.append(label);
				const remove = document.createElement('button');
				remove.type = 'button';
				remove.className = 'brush-studio-delete-preset';
				remove.dataset.brushDeletePreset = preset.id;
				remove.setAttribute('aria-label', t('common.actions.delete'));
				remove.title = t('common.actions.delete');
				remove.textContent = '×';
				group.append(button, remove);
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
		});

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
			}
		});
		host.addEventListener('click', (event) => {
			const button = event.target.closest?.('button');
			if (!button || !host.contains(button)) return;
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
			update(latestState);
		};
		update(latestState);
		const unsubscribe = brushState.subscribe(update);
		window.addEventListener('paint:locale-change', refreshLocale);
		const refreshPreviewColor = () => renderPreview(latestState);
		window.addEventListener('paint:primary-color-change', refreshPreviewColor);
		return () => {
			unsubscribe();
			window.removeEventListener('paint:locale-change', refreshLocale);
			window.removeEventListener('paint:primary-color-change', refreshPreviewColor);
		};
	},
});
