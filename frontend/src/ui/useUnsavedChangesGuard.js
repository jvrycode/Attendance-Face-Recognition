import { useCallback, useEffect, useRef } from 'react';
import { confirmAction } from './ConfirmDialog';

/**
 * Protects a modal (or any container) from losing edits when it is closed.
 *
 * It watches the form controls inside `containerRef` and, when the user has
 * actually changed something, asks "Discard unsaved changes?" before running
 * `onClose`. No per-form state wiring is needed.
 *
 *   const { containerRef, requestClose } = useUnsavedChangesGuard(onClose);
 *
 * Controls marked with `data-guard-ignore` (e.g. search boxes) are skipped.
 */

const FIELD_SELECTOR = 'input, select, textarea';

function snapshotFields(root) {
  if (!root) return '';
  const values = [];
  root.querySelectorAll(FIELD_SELECTOR).forEach((field) => {
    if (field.closest('[data-guard-ignore]')) return;
    const type = (field.type || '').toLowerCase();
    if (type === 'button' || type === 'submit' || type === 'reset' || type === 'hidden') return;
    if (type === 'checkbox' || type === 'radio') values.push(field.checked ? '1' : '0');
    else if (field.multiple && field.options) values.push(Array.from(field.selectedOptions).map((o) => o.value).join(','));
    else values.push(field.value ?? '');
  });
  return JSON.stringify(values);
}

export const DISCARD_CHANGES_PROMPT = {
  title: 'Discard unsaved changes?',
  message: 'You have edits that have not been saved. If you close now, they will be lost.',
  confirmLabel: 'Discard changes',
  cancelLabel: 'Keep editing',
  tone: 'danger',
};

export default function useUnsavedChangesGuard(onClose, { disabled = false, busy = false } = {}) {
  const containerRef = useRef(null);
  const baselineRef = useRef(null);
  const touchedRef = useRef(false);
  const pendingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Take the baseline right before the first user interaction, so values that
  // load asynchronously after opening are not mistaken for edits.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return undefined;
    const captureBaseline = (event) => {
      if (baselineRef.current === null && event.target?.matches?.(FIELD_SELECTOR)) {
        baselineRef.current = snapshotFields(root);
      }
    };
    const markTouched = (event) => {
      if (event.target?.matches?.(FIELD_SELECTOR) && !event.target.closest('[data-guard-ignore]')) touchedRef.current = true;
    };
    root.addEventListener('focusin', captureBaseline, true);
    root.addEventListener('pointerdown', captureBaseline, true);
    root.addEventListener('input', markTouched, true);
    root.addEventListener('change', markTouched, true);
    return () => {
      root.removeEventListener('focusin', captureBaseline, true);
      root.removeEventListener('pointerdown', captureBaseline, true);
      root.removeEventListener('input', markTouched, true);
      root.removeEventListener('change', markTouched, true);
    };
  }, []);

  const isDirty = useCallback(() => {
    if (disabled || !touchedRef.current) return false;
    return baselineRef.current === null || snapshotFields(containerRef.current) !== baselineRef.current;
  }, [disabled]);

  const requestClose = useCallback(async () => {
    if (busy || pendingRef.current) return false;
    if (isDirty()) {
      pendingRef.current = true;
      const discard = await confirmAction(DISCARD_CHANGES_PROMPT);
      pendingRef.current = false;
      if (!discard) return false;
    }
    touchedRef.current = false;
    baselineRef.current = null;
    onCloseRef.current?.();
    return true;
  }, [busy, isDirty]);

  return { containerRef, requestClose, isDirty, isPrompting: () => pendingRef.current };
}
