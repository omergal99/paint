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
  const ancestorsOf = (menu) => {
    const ancestors = [];
    let parent = menu.parentElement;
    while (parent) {
      if (parent.classList?.contains('action-menu')) ancestors.push(parent);
      parent = parent.parentElement;
    }
    return ancestors;
  };

  const closeAll = (keep = []) => root.querySelectorAll('.action-menu.open').forEach((menu) => {
    if (!keep.includes(menu)) closeMenu(menu);
  });

  const positionMenu = (menu, menuItems, { x, y } = {}) => {
    menuItems.style.visibility = 'hidden';
    menuItems.style.display = 'grid';
    const menuHeight = menuItems.getBoundingClientRect().height || 80;
    const menuWidth = menuItems.getBoundingClientRect().width || 180;
    menuItems.style.display = '';
    menuItems.style.visibility = '';

    const requestedX = Number.isFinite(x) ? x : 0;
    const requestedY = Number.isFinite(y) ? y : 0;
    const maxX = Math.max(8, window.innerWidth - menuWidth - 8);
    const maxY = Math.max(8, window.innerHeight - menuHeight - 8);
    menuItems.style.left = `${Math.round(Math.min(Math.max(8, requestedX), maxX))}px`;
    menuItems.style.top = `${Math.round(Math.min(Math.max(8, requestedY), maxY))}px`;
  };

  const openMenuAt = (menu, point = {}) => {
    const menuItems = menu?.querySelector('.action-menu-items');
    if (!menu || !menuItems) return false;
    closeAll([menu]);
    menu.hidden = false;
    menu.classList.add('open');
    positionMenu(menu, menuItems, point);
    return true;
  };

  const toggleMenu = (trigger) => {
    const menu = trigger.closest('.action-menu');
    const menuItems = menu?.querySelector('.action-menu-items');
    if (!menu || !menuItems) return;
    const shouldOpen = !menu.classList.contains('open');
    const keep = shouldOpen ? [menu, ...ancestorsOf(menu)] : [];
    closeAll(keep);
    trigger.setAttribute('aria-expanded', String(shouldOpen));
    if (!shouldOpen) return;

    const bounds = trigger.getBoundingClientRect();
    menuItems.style.visibility = 'hidden';
    menuItems.style.display = 'grid';
    const menuHeight = menuItems.getBoundingClientRect().height || 80;
    const menuWidth = menuItems.getBoundingClientRect().width || 180;
    menuItems.style.display = '';
    menuItems.style.visibility = '';
    const isSubmenu = menu.classList.contains('action-submenu');
    if (isSubmenu) {
      const parentBounds = trigger.closest('.action-menu-items')?.getBoundingClientRect();
      const right = bounds.right + 2;
      const openLeft = right + menuWidth > window.innerWidth - 8;
      menuItems.style.left = `${Math.round(openLeft ? bounds.left - menuWidth - 2 : right)}px`;
      menuItems.style.top = `${Math.round(parentBounds?.top ? Math.max(parentBounds.top, bounds.top) : bounds.top)}px`;
      menuItems.dataset.direction = openLeft ? 'left' : 'right';
    } else {
      const spaceBelow = window.innerHeight - bounds.bottom;
      const openAbove = spaceBelow < menuHeight + 8 && bounds.top >= menuHeight + 8;
      menuItems.style.top = `${Math.round(openAbove ? bounds.top - menuHeight - 2 : bounds.bottom + 2)}px`;
      menuItems.dataset.direction = openAbove ? 'up' : 'down';
    }
    menu.classList.add('open');
  };

  const toggle = (event) => {
    event.stopPropagation();
    toggleMenu(event.currentTarget);
  };

  const firstMenuItem = (menu) => menu?.querySelector('.action-menu-items [role="menuitem"]');
  const directTrigger = (menu) => [...(menu?.children || [])]
    .find((child) => child.classList?.contains('action-menu-trigger'));

  const handleKeyboard = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      const openMenus = [...root.querySelectorAll('.action-menu.open')];
      const activeMenu = event.target.closest?.('.action-menu') || openMenus.at(-1);
      const parentTrigger = directTrigger(activeMenu);
      closeAll();
      if (parentTrigger) setTimeout(() => parentTrigger.focus(), 0);
      return;
    }

    const trigger = event.target.closest?.('.action-menu-trigger');
    if (!trigger) return;
    const menu = trigger.closest('.action-menu');
    if (!menu) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      const isSubmenu = menu.classList.contains('action-submenu');
      if (event.key === 'ArrowRight' && !isSubmenu) return;
      event.preventDefault();
      if (!menu.classList.contains('open')) toggleMenu(trigger);
      firstMenuItem(menu)?.focus();
      return;
    }

    if (event.key === 'ArrowLeft' && menu.classList.contains('action-submenu')) {
      event.preventDefault();
      const submenuTrigger = directTrigger(menu);
      closeMenu(menu);
      submenuTrigger?.focus();
    }
  };

  const bind = () => {
    root.querySelectorAll('.action-menu-trigger').forEach((trigger) => {
      trigger.addEventListener('click', toggle);
    });
    root.addEventListener('click', () => closeAll());
    root.addEventListener('keydown', handleKeyboard);
    root.addEventListener('paint:action-menu-open-at', (event) => {
      const { menu, x, y } = event.detail || {};
      openMenuAt(menu, { x, y });
    });
  };

  return Object.freeze({ bind, closeAll, toggle, openAt: openMenuAt });
};
