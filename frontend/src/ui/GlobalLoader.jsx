import React, { useEffect, useState } from 'react';
import { recordInteraction, subscribe } from './loadingStore';
import { Spinner } from './Spinner';

const BAR_DELAY_MS = 120; // skip the bar for instant responses
const PILL_DELAY_MS = 650; // only show the "Loading" pill for slower requests

/**
 * Mounted once at the app root.
 * - Top progress bar while any foreground request is in flight.
 * - Floating "Loading…" pill for slow requests that were not started by a
 *   button (the button shows its own spinner in that case).
 * - Tracks which `.btn` the user activated so the loading store can put a
 *   spinner on it automatically.
 */
export default function GlobalLoader() {
  const [state, setState] = useState({ foreground: 0, unattributed: 0 });
  const [barReady, setBarReady] = useState(false);
  const [pillReady, setPillReady] = useState(false);

  useEffect(() => subscribe(setState), []);

  useEffect(() => {
    const onClick = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('.btn');
      recordInteraction(button && !button.disabled ? button : null);
    };
    const onSubmit = (event) => {
      const submitter = event.submitter || event.target?.querySelector?.('button[type="submit"].btn');
      if (submitter?.classList?.contains('btn')) recordInteraction(submitter);
    };
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
    };
  }, []);

  const hasForeground = state.foreground > 0;
  const hasUnattributed = state.unattributed > 0;

  // Delay indicators so instant responses never flash.
  useEffect(() => {
    if (!hasForeground) return undefined;
    const timer = setTimeout(() => setBarReady(true), BAR_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setBarReady(false);
    };
  }, [hasForeground]);

  useEffect(() => {
    if (!hasUnattributed) return undefined;
    const timer = setTimeout(() => setPillReady(true), PILL_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setPillReady(false);
    };
  }, [hasUnattributed]);

  const showBar = hasForeground && barReady;
  const showPill = hasUnattributed && pillReady;

  return (
    <>
      <div className={`global-progress ${showBar ? 'is-active' : ''}`} aria-hidden="true">
        <div className="global-progress-bar" />
      </div>
      {showPill && (
        <div className="global-loading-pill" role="status" aria-live="polite">
          <Spinner size="sm" />
          <span>Loading…</span>
        </div>
      )}
    </>
  );
}
