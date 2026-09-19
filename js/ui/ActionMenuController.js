// Functional controller for every ribbon action menu. Keeping open/close,
// direction, outside-click, Escape, and aria state in one seam prevents new
// menus (including dynamically-created palette menus) from drifting.

const closeMenu = (menu) => {
  menu.classList.remove('open');
  if (menu.classList.contains('color-palette-context-menu')) menu.hidden = true;
  menu.querySelector('.action-menu-trigger')?.setAttribute('aria-expanded', 'false');
  const items = menu.querySelector('.action-menu-items');
  items?.style.removeProperty('top');
  items?.style.removeProperty('left');
  if (items) delete items.dataset.direction;
};

export const createActionMenuController = ({ root = document } = {}) => {
  const closeAll = () => root.querySelectorAll('.action-menu.open').forEach(closeMenu);

  const toggle = (event) => {
    event.stopPropagation();
    const trigger = event.currentTarget;
    const menu = trigger.closest('.action-menu');
    const menuItems = menu?.querySelector('.action-menu-items');
    if (!menu || !menuItems) return;
    const shouldOpen = !menu.classList.contains('open');
    closeAll();
    trigger.setAttribute('aria-expanded', String(shouldOpen));
    if (!shouldOpen) return;

    const bounds = trigger.getBoundingClientRect();
    menuItems.style.left = `${Math.round(bounds.left)}px`;
    menuItems.style.visibility = 'hidden';
    menuItems.style.display = 'grid';
    const menuHeight = menuItems.getBoundingClientRect().height || 80;
    menuItems.style.display = '';
    menuItems.style.visibility = '';
    const spaceBelow = window.innerHeight - bounds.bottom;
    const openAbove = spaceBelow < menuHeight + 8 && bounds.top >= menuHeight + 8;
    menuItems.style.top = `${Math.round(openAbove ? bounds.top - menuHeight - 2 : bounds.bottom + 2)}px`;
    menuItems.dataset.direction = openAbove ? 'up' : 'down';
    menu.classList.add('open');
  };

  const bind = () => {
    root.querySelectorAll('.action-menu-trigger').forEach((trigger) => {
      trigger.addEventListener('click', toggle);
    });
    root.addEventListener('click', closeAll);
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeAll();
    });
  };

  return Object.freeze({ bind, closeAll, toggle });
};
