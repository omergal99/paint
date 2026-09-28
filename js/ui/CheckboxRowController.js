export const createCheckboxRowController = ({ root = document } = {}) => {
  let bound = false;

  const onClick = (event) => {
    const target = event.target;
    const row = target?.closest?.('.checkbox-row, .menu-checkbox');
    if (!row || target.closest?.('input, label, button, a, select, textarea')) return;
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (!checkbox || checkbox.disabled) return;
    checkbox.focus?.({ preventScroll: true });
    checkbox.checked = !checkbox.checked;
    const EventConstructor = root.defaultView?.Event || globalThis.Event;
    checkbox.dispatchEvent(new EventConstructor('change', { bubbles: true }));
  };

  const bind = () => {
    if (bound) return;
    root.addEventListener('click', onClick);
    bound = true;
  };
  const destroy = () => {
    if (!bound) return;
    root.removeEventListener('click', onClick);
    bound = false;
  };

  return Object.freeze({ bind, destroy });
};
