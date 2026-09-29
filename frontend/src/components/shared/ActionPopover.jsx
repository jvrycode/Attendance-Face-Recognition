import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

const GAP = 4; // px between trigger and menu
const EDGE = 8; // keep this far from the viewport edge
const MIN_SCROLL_HEIGHT = 120;

/**
 * Row actions menu (3-dots).
 *
 * The menu renders in a portal with fixed positioning, so it is never clipped
 * by table/card overflow. Placement is measured from the real menu size:
 * it opens below the trigger when it fits, flips above when there is more
 * room there, and scrolls internally when the list is taller than either side.
 */
export default function ActionPopover({ items = [], dropup: forcedDropup, label = 'Actions' }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null); // { top, left, maxHeight, placement }
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const rect = trigger.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const menuH = menu.scrollHeight;
    const menuW = menu.offsetWidth;

    const spaceBelow = viewportH - rect.bottom - GAP - EDGE;
    const spaceAbove = rect.top - GAP - EDGE;

    let placement;
    if (forcedDropup !== undefined) placement = forcedDropup ? 'top' : 'bottom';
    else if (menuH <= spaceBelow) placement = 'bottom';
    else if (menuH <= spaceAbove) placement = 'top';
    else placement = spaceBelow >= spaceAbove ? 'bottom' : 'top';

    const available = Math.max(placement === 'bottom' ? spaceBelow : spaceAbove, MIN_SCROLL_HEIGHT);
    const height = Math.min(menuH, available);
    const top = placement === 'bottom' ? rect.bottom + GAP : rect.top - GAP - height;

    // Right-align to the trigger, clamped inside the viewport.
    let left = rect.right - menuW;
    left = Math.min(Math.max(left, EDGE), viewportW - menuW - EDGE);

    setPosition({ top: Math.max(top, EDGE), left, maxHeight: available, placement });
  }, [forcedDropup]);

  // Measure after the menu mounts (before paint, so it never flashes in the wrong spot).
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place, items.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (triggerRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) return;
      close();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') close(true);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const buttons = Array.from(menuRef.current?.querySelectorAll('button:not(:disabled)') || []);
        if (!buttons.length) return;
        event.preventDefault();
        const index = buttons.indexOf(document.activeElement);
        const next = event.key === 'ArrowDown' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
        buttons[next].focus();
      }
    };
    // Scrolling the page would detach a fixed menu from its row, so close it instead.
    const onScroll = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [open, close, place]);

  const handleToggle = (event) => {
    event.stopPropagation();
    if (open) close();
    else setOpen(true);
  };

  const menu = open && (
    <div
      ref={menuRef}
      role="menu"
      className="action-popover-menu open is-portal"
      data-placement={position?.placement || 'bottom'}
      style={{
        position: 'fixed',
        top: position ? position.top : -9999,
        left: position ? position.left : -9999,
        maxHeight: position ? position.maxHeight : undefined,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      {items.map((item, idx) => {
        if (item.isDivider) return <div key={`div-${idx}`} className="action-popover-divider" role="separator" />;
        const Icon = item.icon;
        let className = 'action-popover-item';
        if (item.isDanger) className += ' text-danger';
        else if (item.isPrimary) className += ' text-primary';
        else if (item.isSuccess) className += ' text-success';
        if (item.disabled) className += ' disabled';
        return (
          <button
            key={idx}
            type="button"
            role="menuitem"
            className={className}
            disabled={item.disabled}
            title={item.title}
            aria-disabled={item.disabled || undefined}
            onClick={(event) => {
              event.stopPropagation();
              if (item.disabled) return;
              close();
              item.onClick?.();
            }}
          >
            {Icon && <Icon size={14} aria-hidden="true" />}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="action-popover-dropdown">
      <button
        ref={triggerRef}
        type="button"
        className={`action-popover-trigger ${open ? 'active' : ''}`}
        onClick={handleToggle}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </button>
      {menu && createPortal(menu, document.body)}
    </div>
  );
}
