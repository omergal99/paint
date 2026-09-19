// Small reusable choice control. It mirrors a native select so existing form
// and keyboard logic can keep using the select while the visible control gives
// users fast, clear buttons with an always-visible selected value.

export const createSegmentedChoice = ({ root, select, selectedLabel } = {}) => {
  const label = selectedLabel || root?.querySelector('[data-selected-label]');
  if (!root || !select) return Object.freeze({ render() {} });

  select.classList.add('visually-hidden-control');

  const render = () => {
    root.querySelectorAll('button[data-choice]').forEach((button) => button.remove());
    [...select.options].forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.choice = option.value;
      button.textContent = option.textContent;
      button.className = 'segmented-choice-option';
      button.classList.toggle('selected', option.value === select.value);
      button.setAttribute('aria-pressed', String(option.value === select.value));
      button.addEventListener('click', () => {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      root.appendChild(button);
    });
    if (label) {
      const option = select.options[select.selectedIndex];
      label.textContent = option ? option.textContent : '';
    }
  }

  select.addEventListener('change', render);
  render();
  return Object.freeze({ render });
}
