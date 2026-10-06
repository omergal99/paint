// js/app/fileActions.js
// File operations: new/open/import/save/export plus the background-removal
// wiring that owns the file inputs. Extracted from main.js (Phase 3
// modularisation): collaborators are injected, so this module never reaches for
// a global and the composition root keeps the wiring visible.
import { t } from '../i18n/messages.js';
import { assessImageAdmission } from '../storage/ImageAdmission.js';
import { createBackgroundRemovalController } from '../background/BackgroundRemovalController.js';
import { createBackgroundMaskEditor } from '../background/BackgroundMaskEditor.js';
import { router } from './router.js';

/**
 * @param {object} deps collaborators owned by main.js
 * @returns the file actions the rest of the app (Toolbar handlers, menus, tests)
 *          still calls, so nothing else has to know where they live.
 */
export const initFileActions = ({
  canvasManager,
  historyManager,
  statusBar,
  sidebar,
  clipboardManager,
  setSelection,
  commitFloatingSelection,
  getSelection,
  setDialogUrl,
  shouldAutoSaveHistory,
  shouldAutoSaveOnNew,
  backgroundRemovalService,
  commitFloatingPixels,
  discardFloatingSelection,
  bgSelect,
}) => {
let fileHandle = null;
const fileInput = document.getElementById('file-input');

const persistSession = () => {
	canvasManager.persistToStorage();
}

const canvasToPngBlob = (source) => new Promise((resolve) => {
		if (typeof source?.toBlob !== 'function') return resolve(null);
		source.toBlob((blob) => resolve(blob || null), 'image/png');
});

const getBackgroundRemovalInput = async () => {
	const region = canvasManager.selection?.w && canvasManager.selection?.h
		? { ...canvasManager.selection }
		: null;
	const target = canvasManager.floatingCanvas ? 'floating' : (region ? 'selection' : 'canvas');
	const source = canvasManager.floatingCanvas
		? canvasManager.floatingCanvas
		: (region ? canvasManager.extractRegion(region) : canvasManager.createCompositeCanvas());
	const blob = await canvasToPngBlob(source);
	if (!blob) throw new Error('This browser could not prepare the image preview.');
	return { blob, region, target };
};

const backgroundMaskEditor = createBackgroundMaskEditor({
	root: document.getElementById('background-removal-preview-stage'),
	overlay: document.getElementById('background-removal-mask-overlay'),
});

// Removing the background of the whole page leaves only transparent pixels,
// so the Canvas Background setting must follow what the user now sees: switch
// it to Transparent and let the normal change pipeline apply the mode, save
// the settings, and refresh the segmented "Selected:" label.
const syncCanvasBackgroundAfterRemoval = (region) => {
	const coversWholePage = !region
		|| (region.x <= 0 && region.y <= 0
			&& region.w >= canvasManager.width
			&& region.h >= canvasManager.height);
	// Checkerboard already behaves like Transparent, so only opaque choices
	// need to move.
	if (!coversWholePage || ['transparent', 'checkerboard'].includes(bgSelect.value)) return;
	bgSelect.value = 'transparent';
	bgSelect.dispatchEvent(new Event('change'));
};

const applyBackgroundRemovalResult = async (result) => {
	historyManager.snapshot({ force: true });
	if (result?.target === 'floating' && canvasManager.floatingCanvas && typeof createImageBitmap === 'function') {
		let bitmap = null;
		try {
			// A pasted selection is a temporary layer and is not part of the
			// snapshot stream. Commit it only after Apply (the snapshot above still
			// represents the pre-Apply document), then replace its region with the
			// processed output so undo remains reliable.
			const region = result.region || canvasManager.selection;
			if (!region) return false;
			commitFloatingPixels(region);
			canvasManager.floatingCanvas = null;
			canvasManager.flattenLayers();
			bitmap = await createImageBitmap(result.imageBlob);
			canvasManager.fillRegion(region, canvasManager.backgroundColor);
			canvasManager.ctx.drawImage(bitmap, region.x, region.y, region.w, region.h);
			canvasManager.clearOverlay();
			setSelection(null);
			canvasManager.markDocumentDirty();
			persistSession();
			syncCanvasBackgroundAfterRemoval(region);
			statusBar.flash('Background preview applied to the active selection');
			return true;
		} catch {
			return false;
		} finally {
			bitmap?.close?.();
		}
	}
	// The preview is composed from raster and text layers. Flatten only after
	// Apply so cancelling never changes the working document.
	canvasManager.flattenLayers();
	if (!result?.region) {
		const loaded = await canvasManager.loadImageBlob(result.imageBlob, result.width, result.height);
		if (loaded) {
			persistSession();
			syncCanvasBackgroundAfterRemoval(null);
		}
		return loaded;
	}
	if (typeof createImageBitmap !== 'function') return false;
	let bitmap = null;
	try {
		bitmap = await createImageBitmap(result.imageBlob);
		canvasManager.fillRegion(result.region, canvasManager.backgroundColor);
		canvasManager.ctx.drawImage(bitmap, result.region.x, result.region.y, result.region.w, result.region.h);
		canvasManager.clearOverlay();
		setSelection(null);
		canvasManager.markDocumentDirty();
		persistSession();
		syncCanvasBackgroundAfterRemoval(result.region);
		return true;
	} catch {
		return false;
	} finally {
		bitmap?.close?.();
	}
};

const backgroundRemovalController = createBackgroundRemovalController({
	dialog: document.getElementById('background-removal-dialog'),
	message: document.getElementById('background-removal-message'),
	phase: document.getElementById('background-removal-phase'),
	progress: document.getElementById('background-removal-progress'),
	preview: document.getElementById('background-removal-preview'),
	applyButton: document.getElementById('background-removal-apply'),
	cancelButton: document.getElementById('background-removal-cancel'),
	closeButton: document.getElementById('background-removal-close'),
	previewButton: document.getElementById('background-removal-preview-button'),
	service: backgroundRemovalService,
	getInput: getBackgroundRemovalInput,
	getOptions: () => ({
		tolerance: Number(document.getElementById('background-removal-tolerance')?.value || 30),
		backgroundColor: document.getElementById('background-removal-color')?.value || '#ffffff',
		mode: document.getElementById('background-removal-mode')?.value || 'color-key',
		edgeSoftness: Number(document.getElementById('background-removal-softness')?.value || 25),
		...backgroundMaskEditor.getRegions(),
	}),
	applyResult: applyBackgroundRemovalResult,
	onOpen: () => backgroundMaskEditor.clear(),
	onClose: () => backgroundMaskEditor.clear(),
});

document.getElementById('background-removal-tolerance')?.addEventListener('input', (event) => {
	const value = document.getElementById('background-removal-tolerance-value');
	if (value) value.value = event.target.value;
	if (value) value.textContent = event.target.value;
});
document.getElementById('background-removal-softness')?.addEventListener('input', (event) => {
	const value = document.getElementById('background-removal-softness-value');
	if (value) value.textContent = event.target.value;
});
document.getElementById('background-removal-sample')?.addEventListener('click', () => {
	const source = canvasManager.floatingCanvas || canvasManager.canvas;
	try {
		const pixel = source?.getContext?.('2d', { willReadFrequently: true })?.getImageData(0, 0, 1, 1)?.data;
		if (!pixel || pixel[3] === 0) return;
		const hex = [...pixel.slice(0, 3)].map((channel) => Number(channel).toString(16).padStart(2, '0')).join('');
		const color = document.getElementById('background-removal-color');
		if (color) color.value = `#${hex}`;
	} catch {
		statusBar.flash('Could not sample the source color');
	}
});
const setBackgroundMaskTool = (tool) => {
	backgroundMaskEditor.setTool(tool);
	document.getElementById('background-removal-keep')?.setAttribute('aria-pressed', String(tool === 'keep'));
	document.getElementById('background-removal-remove')?.setAttribute('aria-pressed', String(tool === 'remove'));
};
document.getElementById('background-removal-keep')?.addEventListener('click', () => setBackgroundMaskTool('keep'));
document.getElementById('background-removal-remove')?.addEventListener('click', () => setBackgroundMaskTool('remove'));
document.getElementById('background-removal-clear-mask')?.addEventListener('click', () => backgroundMaskEditor.clear());
document.getElementById('background-removal-expand')?.addEventListener('click', (event) => {
	const dialog = document.getElementById('background-removal-dialog');
	const expanded = dialog?.classList.toggle('is-expanded') === true;
	event.currentTarget.setAttribute('aria-pressed', String(expanded));
	event.currentTarget.textContent = expanded ? 'Compact' : 'Expand';
});
document.getElementById('background-removal-zoom')?.addEventListener('input', (event) => {
	const scale = Math.max(0.5, Number(event.target.value) / 100);
	const stage = document.getElementById('background-removal-preview-stage');
	if (stage) stage.style.setProperty('--background-preview-scale', String(scale));
});

const selectAll = () => {
	setSelection({ x: 0, y: 0, w: canvasManager.width, h: canvasManager.height });
}

const deleteSelection = () => {
	const sel = getSelection();
	if (!sel || !sel.w || !sel.h) return false;
	if (canvasManager.floatingCanvas) {
		canvasManager.floatingCanvas = null;
		setSelection(null);
	} else {
		historyManager.snapshot();
		canvasManager.fillRegion(sel, canvasManager.backgroundColor);
		setSelection(null);
	}
	persistSession();
	statusBar.flash('Deleted selection');
	return true;
}

const newFile = () => {
	if (shouldAutoSaveOnNew()) {
		void doNewFile();
		return;
	}
	const dialog = document.getElementById('new-file-dialog');
	const button = document.getElementById('btn-new').getBoundingClientRect();
	dialog.style.left = '';
	dialog.style.right = '';
	if (document.documentElement?.dir === 'rtl') {
		dialog.style.right = `${Math.max(12, Math.round(window.innerWidth - button.right))}px`;
	} else {
		dialog.style.left = `${Math.max(12, Math.round(button.left))}px`;
	}
	dialog.style.top = `${Math.round(button.bottom + 8)}px`;
	dialog.showModal();
	setDialogUrl('new');
	document.getElementById('new-file-ok')?.focus();
}

const doNewFile = async () => {
	const { width, height } = getDefaultCanvasSize();
	const admission = assessImageAdmission({ width, height });
	if (!admission.ok) {
		statusBar.flash(admission.message);
		return;
	}
	if (shouldAutoSaveOnNew()) await sidebar.saveCurrentToHistory();
	else if (shouldAutoSaveHistory()) await sidebar.saveCurrentToHistory();
	discardFloatingSelection();
	historyManager.clear();
	fileHandle = null;
	canvasManager.loadFromSource(makeBlankSource(width, height));
	setSelection(null);
	persistSession();
	document.getElementById('new-file-dialog').close();
	if (router.param('dialog') === 'new') setDialogUrl(null);
}

const makeBlankSource = (w, h) => {
	const c = document.createElement('canvas');
	c.width = w;
	c.height = h;
	const ctx = c.getContext('2d');
	if (canvasManager.backgroundMode !== 'transparent') {
		ctx.fillStyle = canvasManager.backgroundColor;
		ctx.fillRect(0, 0, w, h);
	} else {
		ctx.clearRect(0, 0, w, h);
	}
	return c;
}

const getDefaultCanvasSize = () => {
	const value = document.getElementById('setting-default-canvas-size')?.value || '800x600';
	const customWidth = Number(document.getElementById('setting-default-canvas-width')?.value);
	const customHeight = Number(document.getElementById('setting-default-canvas-height')?.value);
	const source = value === 'custom' && customWidth > 0 && customHeight > 0
		? `${customWidth}x${customHeight}`
		: value;
	const [width, height] = source.split('x').map(Number);
	return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
		? { width, height }
		: { width: 800, height: 600 };
}

const openFile = () => {
	fileInput.dataset.mode = 'open';
	fileInput.click();
}

const importFile = () => {
	fileInput.dataset.mode = 'import';
	fileInput.click();
}

const openImageFile = async (file) => {
	let bitmap = null;
	try {
		bitmap = await createImageBitmap(file);
		const admission = assessImageAdmission({ width: bitmap.width, height: bitmap.height });
		if (!admission.ok) {
			statusBar.flash(admission.message);
			return false;
		}
		discardFloatingSelection();
		historyManager.snapshot();
		if (!canvasManager.loadFromSource(bitmap)) return false;
		fileHandle = null;
		setSelection(null);
		persistSession();
		statusBar.flash(`Opened ${file.name}`);
		return true;
	} catch (error) {
		console.error('Open image failed:', error);
		statusBar.flash('Image could not be decoded');
		return false;
	} finally {
		bitmap?.close?.();
	}
}

const importImageFile = async (file) => {
	const result = await clipboardManager.insertImageBlob(file, {
		sourceLabel: `Imported ${file.name}`,
	});
	if (result) fileHandle = null;
	return result;
}

fileInput.addEventListener('change', async (e) => {
	const file = e.target.files[0];
	const mode = fileInput.dataset.mode || 'open';
	e.target.value = '';
	fileInput.dataset.mode = '';
	if (!file) return;
	try {
		if (mode === 'import') {
			await importImageFile(file);
			return;
		}
		await openImageFile(file);
	} catch (error) {
		console.error('Image import failed:', error);
		statusBar.flash('Image could not be decoded');
	}
});

const save = async () => {
	commitFloatingSelection();
	if (shouldAutoSaveHistory()) sidebar.saveCurrentToHistory();
	if (window.showSaveFilePicker) {
		try {
			if (!fileHandle) {
				fileHandle = await window.showSaveFilePicker({
					suggestedName: 'untitled.png',
					types: [{ description: 'PNG image', accept: { 'image/png': ['.png'] } }],
				});
			}
			const writable = await fileHandle.createWritable();
			const blob = await canvasManager.toBlob('image/png');
			await writable.write(blob);
			await writable.close();
			persistSession();
			statusBar.flash('Saved');
			document.title = 'paint - ' + fileHandle.name;
			showToast('Successfully saved to ' + fileHandle.name, true);
			return;
		} catch (err) {
			if (err.name === 'AbortError') return;
			console.warn('File System Access save failed, falling back to download:', err);
		}
	}
	await downloadPNG();
}

const downloadPNG = async () => {
	const blob = await canvasManager.toBlob('image/png');
	if (!(blob instanceof Blob) || !globalThis.URL?.createObjectURL) {
		statusBar.flash('PNG download could not be prepared');
		return false;
	}
	const url = URL.createObjectURL(blob);
	try {
		const a = document.createElement('a');
		a.href = url;
		a.download = 'untitled.png';
		a.click();
		statusBar.flash('Downloaded as PNG');
		document.title = 'paint - untitled.png';
		showToast('Successfully downloaded untitled.png', true);
		return true;
	} finally {
		window.setTimeout(() => URL.revokeObjectURL(url), 0);
	}
}

const SAVE_FORMATS = Object.freeze({
	png: Object.freeze({ mime: 'image/png', extension: 'png' }),
	jpeg: Object.freeze({ mime: 'image/jpeg', extension: 'jpg' }),
	webp: Object.freeze({ mime: 'image/webp', extension: 'webp' }),
});

const saveImageAs = async (format, { region = null } = {}) => {
	// Whole-image PNG keeps using the regular Save flow; a selection-scoped
	// export (canvas context menu) always goes through the explicit export
	// path below so it never swaps the document image for the region.
	if (format === 'png' && !region) return save();
	const selectedFormat = SAVE_FORMATS[format];
	if (!selectedFormat) return false;
	commitFloatingSelection();
	if (shouldAutoSaveHistory()) sidebar.saveCurrentToHistory();

	try {
		// `region` re-uses the same extraction the clipboard uses, so lasso
		// bounds and floating pixels behave identically everywhere.
		let source = region ? canvasManager.extractRegion(region) : canvasManager.canvas;
		if (format === 'jpeg') {
			const flattened = document.createElement('canvas');
			flattened.width = source.width;
			flattened.height = source.height;
			const context = flattened.getContext('2d');
			if (!context) throw new Error('Export canvas is unavailable');
			context.fillStyle = '#fff';
			context.fillRect(0, 0, flattened.width, flattened.height);
			context.drawImage(source, 0, 0);
			source = flattened;
		}
		const blob = await new Promise((resolve) => source.toBlob(resolve, selectedFormat.mime, 0.92));
		if (!(blob instanceof Blob) || blob.type !== selectedFormat.mime) {
			statusBar.flash(t('ui.exportFormatUnavailable'));
			return false;
		}
		const url = URL.createObjectURL(blob);
		try {
			const link = document.createElement('a');
			link.href = url;
			link.download = `untitled${region ? '-selection' : ''}.${selectedFormat.extension}`;
			link.click();
			persistSession();
			const message = t('ui.exportedImage', { format: selectedFormat.extension.toUpperCase() });
			statusBar.flash(message);
			showToast(message, true);
			return true;
		} finally {
			window.setTimeout(() => URL.revokeObjectURL(url), 0);
		}
	} catch (error) {
		console.warn('Image export failed:', error);
		statusBar.flash(t('ui.exportFailed'));
		return false;
	}
}

const showToast = (msg, success = true) => {
	const toast = document.createElement('div');
	toast.className = 'toast ' + (success ? 'toast-success' : 'toast-error');
	toast.textContent = msg;
	document.body.appendChild(toast);
	setTimeout(() => {
		toast.classList.add('hide');
		setTimeout(() => toast.remove(), 300);
	}, 3000);
}

const crop = () => {
	const sel = getSelection();
	if (!sel || !sel.w || !sel.h) {
		statusBar.flash('Select an area first');
		return;
	}
	if (canvasManager.floatingCanvas) {
		commitFloatingPixels(sel);
		canvasManager.floatingCanvas = null;
	}
	canvasManager.flattenLayers();
	historyManager.snapshot();
	const region = canvasManager.extractRegion(sel);
	canvasManager.loadFromSource(region);
	setSelection(null);
	persistSession();
}

  return Object.freeze({
    fileInput,
    persistSession,
    backgroundRemovalController,
    selectAll,
    deleteSelection,
    newFile,
    doNewFile,
    getDefaultCanvasSize,
    openFile,
    importFile,
    save,
    saveImageAs,
    showToast,
    crop,
  });
};
