import React, { useEffect, useRef } from 'react';
import useUnsavedChangesGuard from './useUnsavedChangesGuard';

/**
 * Shared modal backdrop with consistent close behaviour for the whole app:
 *
 * - Clicking the dim area, pressing Escape, or clicking any element marked
 *   `data-modal-close` (X / Cancel buttons) all go through one close path.
 * - If the user edited a field inside, they are asked to discard or keep
 *   editing instead of losing the changes silently.
 * - A click that starts inside the card and ends on the backdrop (e.g. while
 *   selecting text) no longer closes the modal.
 *
 *   <ModalBackdrop onClose={close} busy={submitting}>
 *     <div className="modal-card">…<button data-modal-close>Cancel</button></div>
 *   </ModalBackdrop>
 *
 * Props: onClose, busy (blocks closing while saving), guard (default true;
 * set false for read-only modals), className, style, plus any div props.
 */

const openStack = [];

export default function ModalBackdrop({ onClose, busy = false, guard = true, className = '', style, children, ...rest }) {
  const { containerRef, requestClose, isPrompting } = useUnsavedChangesGuard(onClose, { disabled: !guard, busy });
  const pressedOnBackdropRef = useRef(false);
  const idRef = useRef(Symbol('modal'));

  // Escape closes only the top-most modal, and never while a prompt is open.
  useEffect(() => {
    const id = idRef.current;
    openStack.push(id);
    const onKey = (event) => {
      if (event.key !== 'Escape' || openStack[openStack.length - 1] !== id || isPrompting()) return;
      if (document.querySelector('.confirm-backdrop')) return;
      event.preventDefault();
      requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const index = openStack.indexOf(id);
      if (index >= 0) openStack.splice(index, 1);
    };
  }, [requestClose, isPrompting]);

  const handleClickCapture = (event) => {
    // The header X (.modal-close-btn) and any [data-modal-close] button close via the guard.
    const closer = event.target.closest?.('[data-modal-close], .modal-close-btn');
    if (closer && containerRef.current?.contains(closer) && !closer.disabled) {
      event.preventDefault();
      event.stopPropagation();
      requestClose();
    }
  };

  return (
    <div
      {...rest}
      ref={containerRef}
      className={`modal-backdrop open ${className}`.trim()}
      style={{ display: 'flex', opacity: 1, zIndex: 1200, ...style }}
      onMouseDown={(event) => { pressedOnBackdropRef.current = event.target === event.currentTarget; }}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressedOnBackdropRef.current) requestClose();
        pressedOnBackdropRef.current = false;
      }}
      onClickCapture={handleClickCapture}
    >
      {children}
    </div>
  );
}
