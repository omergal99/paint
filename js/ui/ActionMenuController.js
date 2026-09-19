// Functional controller for every ribbon action menu. Keeping open/close,
// direction, outside-click, Escape, and aria state in one seam prevents new
// menus (including dynamically-created palette menus) from drifting.
import { KEYBOARD_KEYS } from '../core/constants.js';

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

  const measureMenu = (menuItems) => {
    menuItems.style.visibility = 'hidden';
    menuItems.style.display = 'grid';
    const { width = 180, height = 80 } = menuItems.getBoundingClientRect();
    menuItems.style.display = '';
    menuItems.style.visibility = '';
    return { width, height };
  };

  const clamp = (value, min, max) => Math.min(Math.max(min, value), Math.max(min, max));

  const positionMenu = (menu, menuItems, {
    x,
    y,
    anchor = null,
    placement = 'below',
  } = {}) => {
    const { width: menuWidth, height: menuHeight } = measureMenu(menuItems);
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 8;
    let requestedX = Number.isFinite(x) ? x : 0;
    let requestedY = Number.isFinite(y) ? y : 0;
    let direction = placement;

    if (anchor) {
      const anchorBounds = typeof anchor.getBoundingClientRect === 'function'
        ? anchor.getBoundingClientRect()
        : anchor;
      const parentBounds = anchor.closest?.('.action-menu-items')?.getBoundingClientRect();
      if (placement === 'submenu') {
        const openLeft = anchorBounds.right + 2 + menuWidth > viewportWidth - margin;
        requestedX = openLeft ? anchorBounds.left - menuWidth - 2 : anchorBounds.right + 2;
        requestedY = parentBounds?.top ? Math.max(parentBounds.top, anchorBounds.top) : anchorBounds.top;
        direction = openLeft ? 'left' : 'right';
      } else {
        const openAbove = viewportHeight - anchorBounds.bottom < menuHeight + margin
          && anchorBounds.top >= menuHeight + margin;
        requestedX = anchorBounds.left;
        requestedY = openAbove ? anchorBounds.top - menuHeight - 2 : anchorBounds.bottom + 2;
        direction = openAbove ? 'up' : 'down';
      }
    }

    const maxX = viewportWidth - menuWidth - margin;
    const maxY = viewportHeight - menuHeight - margin;
    menuItems.style.left = `${Math.round(clamp(requestedX, margin, maxX))}px`;
    menuItems.style.top = `${Math.round(clamp(requestedY, margin, maxY))}px`;
    menuItems.dataset.direction = direction;
  };

  const openMenuAt = (menu, point = {}) => {
    const menuItems = menu?.querySelector('.action-menu-items');
    if (!menu || !menuItems) return false;
    closeAll([menu]);
    menu.hidden = false;
    menu.classList.add('open');
    positionMenu(menu, menuItems, { ...point, placement: 'context' });
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

    const isSubmenu = menu.classList.contains('action-submenu');
    menu.classList.add('open');
    positionMenu(menu, menuItems, {
      anchor: trigger,
      placement: isSubmenu ? 'submenu' : 'below',
    });
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

    if (event.key === KEYBOARD_KEYS.arrowRight || event.key === KEYBOARD_KEYS.arrowDown) {
      const isSubmenu = menu.classList.contains('action-submenu');
      if (event.key === KEYBOARD_KEYS.arrowRight && !isSubmenu) return;
      event.preventDefault();
      if (!menu.classList.contains('open')) toggleMenu(trigger);
      firstMenuItem(menu)?.focus();
      return;
    }

    if (event.key === KEYBOARD_KEYS.arrowLeft && menu.classList.contains('action-submenu')) {
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
