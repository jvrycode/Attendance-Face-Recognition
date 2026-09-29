import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Promise-based confirmation dialog that replaces window.confirm.
 *
 *   const ok = await confirmAction({
 *     title: 'Delete course?',
 *     message: 'This cannot be undone.',
 *     confirmLabel: 'Delete course',
 *     tone: 'danger',
 *     onConfirm: async () => { ... }   // optional: dialog stays open with a spinner until it settles
 *   });
 *
 * When no <ConfirmHost /> is mounted (unit tests, isolated renders) it falls
 * back to window.confirm so behavior stays predictable.
 */

let hostHandler = null;

export function confirmAction(options = {}) {
  const config = typeof options === 'string' ? { message: options } : options;
  if (!hostHandler) {
    const accepted = typeof window !== 'undefined' && typeof window.confirm === 'function'
      ? window.confirm([config.title, config.message].filter(Boolean).join('\n\n'))
      : false;
    if (!accepted) return Promise.resolve(false);
    return Promise.resolve(config.onConfirm ? config.onConfirm() : undefined).then(() => true);
  }
  return new Promise((resolve) => hostHandler({ ...config, resolve }));
}

export function ConfirmHost() {
  const [request, setRequest] = useState(null);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);

  useEffect(() => {
    const handler = (next) => {
      setBusy(false);
      setRequest(next);
    };
    hostHandler = handler;
    // Only clear the registration if it still belongs to this instance, so a
    // late cleanup from a remounted host never drops the app back to the
    // browser's native confirm() popup.
    return () => {
      if (hostHandler === handler) hostHandler = null;
    };
  }, []);

  const close = (result) => {
    if (!request) return;
    request.resolve(result);
    setRequest(null);
    setBusy(false);
  };

  useEffect(() => {
    if (!request) return;
    // Destructive actions focus Cancel first so Enter never deletes by accident.
    const focusTarget = request.tone === 'danger' ? cancelRef.current : confirmRef.current;
    focusTarget?.focus();
  }, [request]);

  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!request || busy) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') closeRef.current(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [request, busy]);

  if (!request) return null;

  const {
    title = 'Please confirm',
    message,
    details,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'primary',
    onConfirm,
  } = request;

  const handleConfirm = async () => {
    if (!onConfirm) {
      close(true);
      return;
    }
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      close(true);
    }
  };

  const dialog = (
    <div className="confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(false); }}>
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
        <div className="confirm-dialog-body">
          <h2 id="confirm-dialog-title">{title}</h2>
          {message && <p id="confirm-dialog-message">{message}</p>}
          {details && <div className="confirm-dialog-details">{details}</div>}
        </div>
        <div className="confirm-dialog-footer">
          <button ref={cancelRef} type="button" className="btn btn-outline" onClick={() => close(false)} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleConfirm}
            disabled={busy}
            data-loading={busy ? 'true' : undefined}
            aria-busy={busy ? 'true' : undefined}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}

export default ConfirmHost;
