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
  items?.style.removeProperty('right');
  if (items) delete items.dataset.direction;
  delete menu.dataset.submenuDirection;
};

export const createActionMenuController = ({ root = document } = {}) => {
  let bound = false;
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

  const isRtl = () => (root.documentElement?.dir || globalThis.document?.documentElement?.dir) === 'rtl';

  // Position from the physical left edge internally, then write the matching
  // physical side. This keeps pointer/context coordinates stable while making
  // RTL menus use `right` instead of accidentally inheriting a left anchor.
  const applyMenuPosition = (menuItems, { left, top, width, height, viewportWidth, viewportHeight }) => {
    const margin = 8;
    const maxLeft = viewportWidth - width - margin;
    const clampedLeft = Math.round(clamp(left, margin, maxLeft));
    const clampedTop = Math.round(clamp(top, margin, viewportHeight - height - margin));
    menuItems.style.left = '';
    menuItems.style.right = '';
    if (isRtl()) {
      menuItems.style.right = `${Math.round(viewportWidth - clampedLeft - width)}px`;
    } else {
      menuItems.style.left = `${clampedLeft}px`;
    }
    menuItems.style.top = `${clampedTop}px`;
  };

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
        const rtl = isRtl();
        const canOpenLeft = anchorBounds.left - menuWidth - 2 >= margin;
        const canOpenRight = anchorBounds.right + 2 + menuWidth <= viewportWidth - margin;
        const openLeft = rtl ? canOpenLeft : !canOpenRight && canOpenLeft;
        requestedX = openLeft ? anchorBounds.left - menuWidth - 2 : anchorBounds.right + 2;
        requestedY = parentBounds?.top ? Math.max(parentBounds.top, anchorBounds.top) : anchorBounds.top;
        direction = openLeft ? 'left' : 'right';
      } else {
        const openAbove = viewportHeight - anchorBounds.bottom < menuHeight + margin
          && anchorBounds.top >= menuHeight + margin;
        requestedX = isRtl() ? anchorBounds.right - menuWidth : anchorBounds.left;
        requestedY = openAbove ? anchorBounds.top - menuHeight - 2 : anchorBounds.bottom + 2;
        direction = openAbove ? 'up' : 'down';
      }
    }

    applyMenuPosition(menuItems, {
      left: requestedX,
      top: requestedY,
      width: menuWidth,
      height: menuHeight,
      viewportWidth,
      viewportHeight,
    });
    menuItems.dataset.direction = direction;
    if (placement === 'submenu') menu.dataset.submenuDirection = direction;
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

    const isSubmenu = menu.classList.contains('action-submenu');
    const isArrowLeft = event.key === KEYBOARD_KEYS.arrowLeft;
    const isArrowRight = event.key === KEYBOARD_KEYS.arrowRight;
    const openSubmenuKey = isRtl() ? KEYBOARD_KEYS.arrowLeft : KEYBOARD_KEYS.arrowRight;
    const closeSubmenuKey = isRtl() ? KEYBOARD_KEYS.arrowRight : KEYBOARD_KEYS.arrowLeft;
    if (event.key === KEYBOARD_KEYS.arrowDown || event.key === openSubmenuKey) {
      if (event.key === openSubmenuKey && !isSubmenu) return;
      event.preventDefault();
      if (!menu.classList.contains('open')) toggleMenu(trigger);
      firstMenuItem(menu)?.focus();
      return;
    }

    if ((isArrowLeft || isArrowRight) && event.key === closeSubmenuKey && isSubmenu) {
      event.preventDefault();
      const submenuTrigger = directTrigger(menu);
      closeMenu(menu);
      submenuTrigger?.focus();
    }
  };

  const handleRootClick = () => closeAll();
  const handleOpenAt = (event) => {
    const { menu, x, y } = event.detail || {};
    openMenuAt(menu, { x, y });
  };

  const bind = () => {
    if (bound) return;
    bound = true;
    root.querySelectorAll('.action-menu-trigger').forEach((trigger) => {
      trigger.addEventListener('click', toggle);
    });
    root.addEventListener('click', handleRootClick);
    root.addEventListener('keydown', handleKeyboard);
    root.addEventListener('paint:action-menu-open-at', handleOpenAt);
  };

  const destroy = () => {
    if (!bound) return;
    root.querySelectorAll('.action-menu-trigger').forEach((trigger) => {
      trigger.removeEventListener('click', toggle);
    });
    root.removeEventListener('click', handleRootClick);
    root.removeEventListener('keydown', handleKeyboard);
    root.removeEventListener('paint:action-menu-open-at', handleOpenAt);
    closeAll();
    bound = false;
  };

  return Object.freeze({ bind, closeAll, toggle, openAt: openMenuAt, destroy });
};
