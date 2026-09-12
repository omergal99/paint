// Small reusable choice control. It mirrors a native select so existing form
// and keyboard logic can keep using the select while the visible control gives
// users fast, clear buttons with an always-visible selected value.

export class SegmentedChoice {
  constructor({ root, select, selectedLabel } = {}) {
    this.root = root;
    this.select = select;
    this.selectedLabel = selectedLabel || root?.querySelector('[data-selected-label]');
    if (!this.root || !this.select) return;
    this.select.classList.add('visually-hidden-control');
    this.select.addEventListener('change', () => this.render());
    this.render();
  }

  render() {
    if (!this.root || !this.select) return;
    this.root.querySelectorAll('button[data-choice]').forEach((button) => button.remove());
    [...this.select.options].forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.choice = option.value;
      button.textContent = option.textContent;
      button.className = 'segmented-choice-option';
      button.classList.toggle('selected', option.value === this.select.value);
      button.setAttribute('aria-pressed', String(option.value === this.select.value));
      button.addEventListener('click', () => {
        this.select.value = option.value;
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      this.root.appendChild(button);
    });
    if (this.selectedLabel) {
      const option = this.select.options[this.select.selectedIndex];
      this.selectedLabel.textContent = option ? option.textContent : '';
    }
  }
}
