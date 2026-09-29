import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cleanToastMessage } from '../../utils/toastText';

/**
 * Floating toast notification.
 *
 * Props:
 * - message: string (the notification text; empty hides the toast)
 * - type: 'success' | 'error' | 'warning' | 'info' (default: 'success')
 * - title: optional short heading. When omitted the message itself is the
 *   headline, so the toast stays a single, scannable line.
 * - duration: auto-close time in ms (default 3500 for success/info, 6000 for
 *   errors/warnings so there is time to read them; 0 disables auto-close)
 * - onClose: callback when the toast closes
 *
 * Hovering the toast pauses the countdown. All toasts render into one shared
 * stack so a success and an error never overlap each other.
 */
const TONES = {
  success: { icon: CheckCircle2, role: 'status', label: 'Success' },
  error: { icon: AlertCircle, role: 'alert', label: 'Error' },
  warning: { icon: AlertTriangle, role: 'alert', label: 'Warning' },
  info: { icon: Info, role: 'status', label: 'Notice' },
};

function getToastRegion() {
  if (typeof document === 'undefined') return null;
  let region = document.getElementById('ui-toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'ui-toast-region';
    region.className = 'ui-toast-region';
    document.body.appendChild(region);
  }
  return region;
}

export default function Toast({ message, type = 'success', title, duration, onClose }) {
  const tone = TONES[type] ? type : 'success';
  const config = TONES[tone];
  const effectiveDuration = duration ?? (tone === 'error' || tone === 'warning' ? 6000 : 3500);
  const text = cleanToastMessage(message);

  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(effectiveDuration);
  const startedRef = useRef(0);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleClose = useCallback(() => {
    setLeaving(true);
    setTimeout(() => {
      setVisible(false);
      setLeaving(false);
      onCloseRef.current?.();
    }, 180);
  }, []);

  useEffect(() => {
    if (message) {
      setVisible(true);
      setLeaving(false);
      setPaused(false);
      remainingRef.current = effectiveDuration;
    } else {
      setVisible(false);
    }
  }, [message, effectiveDuration]);

  useEffect(() => {
    if (!visible || leaving || paused || effectiveDuration <= 0) return undefined;
    startedRef.current = Date.now();
    const timer = setTimeout(handleClose, remainingRef.current);
    return () => {
      clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedRef.current));
    };
  }, [visible, leaving, paused, effectiveDuration, handleClose, message]);

  if (!visible || !text) return null;

  const Icon = config.icon;
  const toast = (
    <div
      className={`ui-toast tone-${tone} ${leaving ? 'is-leaving' : ''}`}
      role={config.role}
      aria-live={config.role === 'alert' ? 'assertive' : 'polite'}
      aria-atomic="true"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span className="ui-toast-icon" aria-hidden="true"><Icon size={18} /></span>
      <div className="ui-toast-content">
        <span className="sr-only">{config.label}: </span>
        {title ? (
          <>
            <div className="ui-toast-title">{title}</div>
            <div className="ui-toast-message">{text}</div>
          </>
        ) : (
          <div className="ui-toast-title">{text}</div>
        )}
      </div>
      <button type="button" className="ui-toast-close" onClick={handleClose} aria-label="Dismiss notification">
        <X size={15} />
      </button>
      {effectiveDuration > 0 && (
        <span
          key={message}
          className="ui-toast-progress"
          style={{ animationDuration: `${effectiveDuration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
        />
      )}
    </div>
  );

  const region = getToastRegion();
  return region ? createPortal(toast, region) : toast;
}
