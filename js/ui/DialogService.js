// DialogService.js
// Promise-based application dialogs. Keeping confirmation and prompt behavior
// here prevents browser-native alert/confirm/prompt UI from leaking into
// feature modules and gives the app one consistent interaction surface.

export const createDialogService = ({ dialog, title, message, preview, closeButton, input, confirmButton, cancelButton, form } = {}) => {
  let ownedPreviewUrl = null;

  const releaseOwnedPreviewUrl = () => {
    if (!ownedPreviewUrl) return;
    URL.revokeObjectURL(ownedPreviewUrl);
    ownedPreviewUrl = null;
  };

  const resolvePreviewSource = (source) => {
    if (!source) return '';
    if (typeof source === 'string') return source;
    if (typeof Blob !== 'undefined' && source instanceof Blob) {
      ownedPreviewUrl = URL.createObjectURL(source);
      return ownedPreviewUrl;
    }
    throw new TypeError('Dialog preview source must be a URL string or Blob');
  };

  const setDynamicText = (element, value) => {
    element.removeAttribute('data-i18n-runtime');
    element.removeAttribute('data-i18n-runtime-source');
    element.textContent = value;
  };

  const setContent = ({ heading, body, confirmLabel, cancelLabel, danger, prompt, preview: previewOptions }) => {
    releaseOwnedPreviewUrl();
    setDynamicText(title, heading);
    setDynamicText(message, body);
    setDynamicText(confirmButton, confirmLabel);
    setDynamicText(cancelButton, cancelLabel);
    confirmButton.classList.toggle('danger', Boolean(danger));
    input.hidden = !prompt;
    input.value = prompt?.value ?? '';
    input.placeholder = prompt?.placeholder || '';
    input.type = prompt?.type || 'text';
    if (preview) {
      const previewSrc = resolvePreviewSource(previewOptions?.src);
      preview.hidden = !previewSrc;
      if (previewSrc) preview.src = previewSrc;
      else preview.removeAttribute('src');
      preview.alt = previewOptions?.alt || '';
    }
    dialog.dataset.dialogMode = prompt ? 'prompt' : 'confirm';
  };

  const open = (options) => new Promise((resolve) => {
    setContent(options);
    const finish = () => {
      dialog.removeEventListener('close', finish);
      releaseOwnedPreviewUrl();
      const accepted = dialog.returnValue === 'confirm';
      resolve(options.prompt ? (accepted ? input.value : null) : accepted);
    };
    dialog.addEventListener('close', finish);
    dialog.showModal();
    if (options.prompt) input.focus();
    else confirmButton.focus();
  });

  confirmButton.addEventListener('click', () => dialog.close('confirm'));
  cancelButton.addEventListener('click', () => dialog.close('cancel'));
  closeButton?.addEventListener('click', () => dialog.close('cancel'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    dialog.close('confirm');
  });

  return {
    confirm(options = {}) {
      return open({
        heading: options.title || 'Please confirm',
        body: options.message || 'Are you sure?',
        confirmLabel: options.confirmLabel || 'Continue',
        cancelLabel: options.cancelLabel || 'Cancel',
        danger: options.danger === true,
        preview: options.preview || null,
      });
    },
    prompt(options = {}) {
      return open({
        heading: options.title || 'Enter a value',
        body: options.message || '',
        confirmLabel: options.confirmLabel || 'Apply',
        cancelLabel: options.cancelLabel || 'Cancel',
        prompt: {
          value: options.value || '',
          placeholder: options.placeholder || '',
          type: options.type || 'text',
        },
      });
    },
  };
}
