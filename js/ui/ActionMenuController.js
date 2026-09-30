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
  // Submenu visibility has two inputs: a click-pinned submenu persists while
  // its parent menu is open, and a hover preview temporarily overrides it.
  // The pinned submenu reappears as soon as no other parent row is hovered.
  let pinnedSubmenu = null;
  let hoverSubmenu = null;
  let hoverSuppressedTrigger = null;
  let hoverClearTimer = 0;
  const HOVER_CLEAR_DELAY_MS = 250;

  const ancestorsOf = (menu) => {
    const ancestors = [];
    let parent = menu.parentElement;
    while (parent) {
      if (parent.classList?.contains('action-menu')) ancestors.push(parent);
      parent = parent.parentElement;
    }
    return ancestors;
  };

  const cancelHoverClear = () => {
    if (!hoverClearTimer) return;
    clearTimeout(hoverClearTimer);
    hoverClearTimer = 0;
  };

  const resetSubmenuState = () => {
    cancelHoverClear();
    pinnedSubmenu = null;
    hoverSubmenu = null;
    hoverSuppressedTrigger = null;
  };

  const closeAll = (keep = []) => {
    root.querySelectorAll('.action-menu.open').forEach((menu) => {
      if (!keep.includes(menu)) closeMenu(menu);
    });
    resetSubmenuState();
  };

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

    if (menu.classList.contains('action-submenu')) {
      // Submenu triggers pin/unpin only their own submenu so a second click
      // never closes the parent menu that hosts it.
      cancelHoverClear();
      hoverSubmenu = null;
      if (pinnedSubmenu === menu) {
        pinnedSubmenu = null;
        // The pointer still rests on the trigger, so block the hover preview
        // from reopening the submenu the user just closed.
        hoverSuppressedTrigger = trigger;
      } else {
        pinnedSubmenu = menu;
        hoverSuppressedTrigger = null;
      }
      syncSubmenus();
      return;
    }

    const shouldOpen = !menu.classList.contains('open');
    const keep = shouldOpen ? [menu, ...ancestorsOf(menu)] : [];
    closeAll(keep);
    trigger.setAttribute('aria-expanded', String(shouldOpen));
    if (!shouldOpen) return;

    menu.classList.add('open');
    positionMenu(menu, menuItems, {
      anchor: trigger,
      placement: 'below',
    });
  };

  const toggle = (event) => {
    event.stopPropagation();
    toggleMenu(event.currentTarget);
  };

  const firstMenuItem = (menu) => menu?.querySelector('.action-menu-items [role="menuitem"]');
  const directTrigger = (menu) => [...(menu?.children || [])]
    .find((child) => child.classList?.contains('action-menu-trigger'));

  // Show only the active submenu chain: the hover preview wins while the
  // pointer rests on a parent row, and the click-pinned submenu is the state
  // everything else falls back to.
  const syncSubmenus = () => {
    const active = hoverSubmenu || pinnedSubmenu;
    const keep = active ? [active, ...ancestorsOf(active)] : [];
    root.querySelectorAll('.action-submenu.open').forEach((menu) => {
      if (!keep.includes(menu)) closeMenu(menu);
    });
    if (!active || active.classList.contains('open')) return;
    if (!active.closest('.action-menu.open')) return;
    const menuItems = active.querySelector('.action-menu-items');
    const trigger = directTrigger(active);
    if (!menuItems) return;
    active.classList.add('open');
    trigger?.setAttribute('aria-expanded', 'true');
    positionMenu(active, menuItems, { anchor: trigger, placement: 'submenu' });
  };

  const setHoverSubmenu = (menu) => {
    cancelHoverClear();
    if (hoverSubmenu === menu) return;
    hoverSubmenu = menu;
    syncSubmenus();
  };

  const clearHoverSubmenu = () => {
    cancelHoverClear();
    if (!hoverSubmenu) return;
    hoverSubmenu = null;
    syncSubmenus();
  };

  // Leaving a parent row keeps the preview alive briefly so crossing the
  // 2px gap to the submenu panel never makes it flicker.
  const scheduleHoverClear = () => {
    if (!hoverSubmenu || hoverClearTimer) return;
    hoverClearTimer = setTimeout(() => {
      hoverClearTimer = 0;
      hoverSubmenu = null;
      syncSubmenus();
    }, HOVER_CLEAR_DELAY_MS);
  };

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
      resetSubmenuState();
      closeMenu(menu);
      // Keep a pointer resting on the trigger from previewing the submenu
      // right after the keyboard closed it.
      hoverSuppressedTrigger = submenuTrigger || null;
      submenuTrigger?.focus();
    }
  };

  // Stay-open panels (Shapes gallery, Text options) host controls that must
  // keep working while the menu is visible, and a menu checkbox row toggles
  // without selecting an action. Both are treated as "not an outside click".
  const stayOpenTarget = (event) => event.target?.closest?.([
    '.action-menu-items.menu-stay-open',
    '.action-menu-items .menu-checkbox',
  ].join(', '));

  const handleRootClick = (event) => {
    if (stayOpenTarget(event)) return;
    closeAll();
  };

  // Delegated hover preview: resting on a submenu parent opens it without
  // pinning, moving to another parent swaps the preview, and leaving the
  // parent rows falls back to the click-pinned submenu after a short grace
  // period. This is one handler for every menu in the app.
  const handlePointerOver = (event) => {
    const target = event.target;
    if (!target?.closest) return;
    if (hoverSuppressedTrigger && !hoverSuppressedTrigger.contains(target)) {
      hoverSuppressedTrigger = null;
    }
    const trigger = target.closest('.action-submenu-trigger');
    if (trigger && trigger !== hoverSuppressedTrigger && target.closest('.action-menu-items')) {
      const menu = trigger.closest('.action-submenu');
      if (menu?.closest('.action-menu.open')) {
        setHoverSubmenu(menu);
        return;
      }
    }
    if (!hoverSubmenu) return;
    const panel = target.closest('.action-menu-items');
    if (!panel) {
      clearHoverSubmenu();
      return;
    }
    if (panel === hoverSubmenu.querySelector('.action-menu-items')) {
      cancelHoverClear();
      return;
    }
    scheduleHoverClear();
  };
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
    root.addEventListener('pointerover', handlePointerOver);
    root.addEventListener('keydown', handleKeyboard);
    root.addEventListener('paint:action-menu-open-at', handleOpenAt);
  };

  const destroy = () => {
    if (!bound) return;
    root.querySelectorAll('.action-menu-trigger').forEach((trigger) => {
      trigger.removeEventListener('click', toggle);
    });
    root.removeEventListener('click', handleRootClick);
    root.removeEventListener('pointerover', handlePointerOver);
    root.removeEventListener('keydown', handleKeyboard);
    root.removeEventListener('paint:action-menu-open-at', handleOpenAt);
    closeAll();
    bound = false;
  };

  return Object.freeze({ bind, closeAll, toggle, openAt: openMenuAt, destroy });
};
