// DialogService.js
// Promise-based application dialogs. Keeping confirmation and prompt behavior
// here prevents browser-native alert/confirm/prompt UI from leaking into
// feature modules and gives the app one consistent interaction surface.

export const createDialogService = ({ dialog, title, message, input, confirmButton, cancelButton, form } = {}) => {
  const setContent = ({ heading, body, confirmLabel, cancelLabel, danger, prompt }) => {
    title.textContent = heading;
    message.textContent = body;
    confirmButton.textContent = confirmLabel;
    cancelButton.textContent = cancelLabel;
    confirmButton.classList.toggle('danger', Boolean(danger));
    input.hidden = !prompt;
    input.value = prompt?.value ?? '';
    input.placeholder = prompt?.placeholder || '';
    input.type = prompt?.type || 'text';
    dialog.dataset.dialogMode = prompt ? 'prompt' : 'confirm';
  };

  const open = (options) => new Promise((resolve) => {
    setContent(options);
    const finish = () => {
      dialog.removeEventListener('close', finish);
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
