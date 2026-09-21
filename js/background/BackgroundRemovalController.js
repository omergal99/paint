// UI orchestration for the safe background-removal service. The controller
// owns only dialog state and cancellation; image/history mutation stays with
// the composition root supplied through applyResult().

const phaseLabel = Object.freeze({
	decode: 'Reading image…',
	remove: 'Removing background…',
	encode: 'Preparing preview…',
	complete: 'Preview ready.',
});

const progressPercent = ({ phase, completed = 0, total = 1 } = {}) => {
	const ratio = total > 0 ? Math.max(0, Math.min(1, completed / total)) : 0;
	if (phase === 'decode') return Math.round(ratio * 5);
	if (phase === 'remove') return 5 + Math.round(ratio * 85);
	if (phase === 'encode') return 95 + Math.round(ratio * 5);
	return phase === 'complete' ? 100 : 0;
};

const errorText = (result) => result?.error?.message || 'Background removal could not finish.';

export const createBackgroundRemovalController = ({
	dialog,
	message,
	phase,
	progress,
	preview,
	applyButton,
	cancelButton,
	closeButton,
	service,
	getInput,
	applyResult,
	urlApi = globalThis.URL,
	AbortControllerCtor = globalThis.AbortController,
} = {}) => {
	let operation = null;
	let pending = null;
	let previewUrl = null;
	let destroyed = false;

	const setPreviewUrl = (url = null) => {
		if (previewUrl && previewUrl !== url) urlApi?.revokeObjectURL?.(previewUrl);
		previewUrl = url;
		if (!preview) return;
		preview.hidden = !url;
		if (url) preview.src = url;
		else preview.removeAttribute?.('src');
	};

	const setBusy = (busy) => {
		dialog?.setAttribute?.('aria-busy', String(Boolean(busy)));
		if (progress) progress.hidden = !busy && !pending;
		if (applyButton) applyButton.disabled = busy || !pending;
		if (cancelButton) cancelButton.hidden = !busy;
		if (closeButton) closeButton.hidden = busy;
	};

	const reset = () => {
		pending = null;
		setPreviewUrl();
		if (message) message.textContent = 'The image stays unchanged until you choose Apply.';
		if (phase) phase.textContent = 'Ready';
		if (progress) {
			progress.value = 0;
			progress.hidden = true;
		}
		setBusy(false);
	};

	const close = () => {
		operation?.abort?.();
		operation = null;
		pending = null;
		setPreviewUrl();
		if (dialog?.open) dialog.close('cancel');
		setBusy(false);
	};

	const updateProgress = (update = {}) => {
		if (phase) phase.textContent = phaseLabel[update.phase] || 'Working…';
		if (progress) {
			progress.hidden = false;
			progress.value = progressPercent(update);
		}
	};

	const apply = async () => {
		if (!pending || operation || destroyed) return false;
		if (applyButton) applyButton.disabled = true;
		if (message) message.textContent = 'Applying the preview…';
		const result = pending;
		const applied = await applyResult?.(result);
		if (!applied) {
			if (message) message.textContent = 'The preview could not be applied. Your image is unchanged.';
			if (applyButton) applyButton.disabled = false;
			return false;
		}
		close();
		return true;
	};

	const run = async () => {
		if (operation || destroyed) return false;
		const controller = typeof AbortControllerCtor === 'function' ? new AbortControllerCtor() : null;
		operation = controller;
		pending = null;
		setPreviewUrl();
		setBusy(true);
		if (message) message.textContent = 'Processing locally in this browser. No image is uploaded.';
		try {
			const input = await getInput?.();
			if (!input?.blob) throw new Error('No image is available for background removal.');
			const result = await service?.remove(input.blob, {
				providerId: 'local-color-key',
				tolerance: 30,
				onProgress: updateProgress,
			}, controller?.signal);
			if (controller?.signal.aborted) return false;
			if (!result?.ok) {
				if (message) message.textContent = errorText(result);
				if (phase) phase.textContent = 'Could not finish';
				if (cancelButton) cancelButton.hidden = true;
				if (closeButton) closeButton.hidden = false;
				return false;
			}
			pending = { ...result, region: input.region || null };
			const url = urlApi?.createObjectURL?.(result.imageBlob);
			setPreviewUrl(url || null);
			if (message) message.textContent = 'Preview ready. Apply it when the result looks right.';
			if (phase) phase.textContent = phaseLabel.complete;
			if (progress) progress.value = 100;
			setBusy(false);
			return true;
		} catch (error) {
			if (!controller?.signal?.aborted) {
				if (message) message.textContent = error?.message || 'Background removal could not finish.';
				if (phase) phase.textContent = 'Could not finish';
				if (cancelButton) cancelButton.hidden = true;
				if (closeButton) closeButton.hidden = false;
			}
			return false;
		} finally {
			if (operation === controller) operation = null;
		}
	};

	const open = async () => {
		if (destroyed || operation) return false;
		reset();
		dialog?.showModal?.();
		return run();
	};

	const onCancel = (event) => {
		event.preventDefault();
		close();
	};
	const onApply = () => { void apply(); };
	cancelButton?.addEventListener?.('click', close);
	closeButton?.addEventListener?.('click', close);
	applyButton?.addEventListener?.('click', onApply);
	dialog?.addEventListener?.('cancel', onCancel);

	const destroy = () => {
		if (destroyed) return;
		destroyed = true;
		operation?.abort?.();
		setPreviewUrl();
		cancelButton?.removeEventListener?.('click', close);
		closeButton?.removeEventListener?.('click', close);
		applyButton?.removeEventListener?.('click', onApply);
		dialog?.removeEventListener?.('cancel', onCancel);
	};

	return Object.freeze({ open, cancel: close, apply, destroy, isBusy: () => Boolean(operation), getPending: () => pending });
};

export { phaseLabel, progressPercent };
