import { useCallback, useEffect, useRef, useState } from 'react';
import { GUIDANCE_MESSAGES } from './useFaceGuidance';
import { grabFrame } from '../../utils/faceCapture';

/**
 * Hands-free face capture (like e-wallet ID verification):
 *
 *   waiting    -> guidance coaches the student until the face is placed well
 *   steady     -> "Hold steady" for a moment once the face is good
 *   countdown  -> 3, 2, 1 — one frame is grabbed on every count
 *   processing -> the frames are sent to the server
 *   done | error
 *
 * The student experiences ONE capture. Behind the scenes the 3 countdown frames let
 * the server average out noise, cross-check that it is the same live person, and
 * reject a still image submitted repeatedly.
 *
 * If the face leaves the oval during the countdown, it restarts.
 * Server rejections for quality (blur, light...) retry automatically a few times;
 * rejections that need a person (duplicate face, cancelled replace) stop and wait.
 */

export const FRAME_COUNT = 3;
const STEADY_MS = 900;
const STEP_MS = 1000;
const RETRY_MS = 2500;
const MAX_AUTO_RETRIES = 3;

export const AUTO_MESSAGES = {
  steady: 'Hold steady…',
  countdown: 'Hold steady',
  processing: 'Processing…',
  done: 'Done! Face enrolled.',
  moved: 'You moved. Let’s try again — look at the camera.',
};

/** Face well placed (or detector unavailable: the server still validates every frame). */
export function isFaceGood(guidance) {
  return guidance?.status === 'ready' || guidance?.status === 'unavailable';
}

/** Face clearly lost or badly placed (ignore the brief "Hold still" warm-up state). */
export function isFaceLost(guidance) {
  if (!guidance) return true;
  if (guidance.status === 'noface' || guidance.status === 'idle') return true;
  return guidance.status === 'adjust' && guidance.message !== GUIDANCE_MESSAGES.holdStill;
}

/** Errors that repeat on every attempt and need someone to act (no auto-retry). */
function needsPerson(error) {
  return Boolean(error?.code) || error?.name === 'AbortError';
}

export default function useAutoFaceCapture({ active, guidance, videoRef, canvasRef, onSubmit, onFlash }) {
  const [phase, setPhase] = useState('waiting');
  const [count, setCount] = useState(FRAME_COUNT);
  const [message, setMessage] = useState('');
  const guidanceRef = useRef(guidance);
  const framesRef = useRef([]);
  const retriesRef = useRef(0);
  const autoRetryRef = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  const onFlashRef = useRef(onFlash);

  useEffect(() => { guidanceRef.current = guidance; }, [guidance]);
  useEffect(() => { onSubmitRef.current = onSubmit; }, [onSubmit]);
  useEffect(() => { onFlashRef.current = onFlash; }, [onFlash]);

  const restart = useCallback((note = '') => {
    framesRef.current = [];
    setCount(FRAME_COUNT);
    setMessage(note);
    setPhase('waiting');
  }, []);

  // Camera turned off/on: start over (a finished enrollment stays "done").
  useEffect(() => {
    if (!active) return;
    setPhase((current) => (current === 'done' ? current : 'waiting'));
    framesRef.current = [];
    retriesRef.current = 0;
    setCount(FRAME_COUNT);
    setMessage('');
  }, [active]);

  // waiting -> steady as soon as the face is good.
  useEffect(() => {
    if (active && phase === 'waiting' && isFaceGood(guidance)) {
      setMessage('');
      setPhase('steady');
    }
  }, [active, phase, guidance]);

  // steady -> countdown after a short hold; back to waiting if the face slips.
  useEffect(() => {
    if (!active || phase !== 'steady') return undefined;
    const timer = setTimeout(() => {
      if (isFaceGood(guidanceRef.current)) {
        framesRef.current = [];
        setCount(FRAME_COUNT);
        setPhase('countdown');
      } else {
        restart();
      }
    }, STEADY_MS);
    return () => clearTimeout(timer);
  }, [active, phase, restart]);

  // countdown: grab a frame on every tick (3, 2, 1); restart if the face is lost.
  useEffect(() => {
    if (!active || phase !== 'countdown') return undefined;
    const timer = setTimeout(() => {
      if (isFaceLost(guidanceRef.current)) {
        restart(AUTO_MESSAGES.moved);
        return;
      }
      const video = videoRef.current;
      if (video) framesRef.current.push(grabFrame(video, canvasRef?.current));
      if (count > 1) {
        setCount(count - 1);
      } else {
        onFlashRef.current?.();
        setPhase('processing');
      }
    }, STEP_MS);
    return () => clearTimeout(timer);
  }, [active, phase, count, videoRef, canvasRef, restart]);

  // processing: send frames once.
  useEffect(() => {
    if (phase !== 'processing') return undefined;
    let cancelled = false;
    const frames = framesRef.current.slice();
    Promise.resolve()
      .then(() => onSubmitRef.current?.(frames))
      .then((result) => {
        if (cancelled) return;
        retriesRef.current = 0;
        setMessage(result?.message || AUTO_MESSAGES.done);
        setPhase('done');
      })
      .catch((error) => {
        if (cancelled) return;
        autoRetryRef.current = !needsPerson(error) && retriesRef.current < MAX_AUTO_RETRIES;
        if (autoRetryRef.current) retriesRef.current += 1;
        setMessage(error?.message || 'Enrollment failed. Please try again.');
        setPhase('error');
      });
    return () => { cancelled = true; };
  }, [phase]);

  // error: quality problems retry by themselves after a pause; others wait for "Try again".
  useEffect(() => {
    if (!active || phase !== 'error' || !autoRetryRef.current) return undefined;
    const note = message ? `${message} Trying again…` : '';
    const timer = setTimeout(() => restart(note), RETRY_MS);
    return () => clearTimeout(timer);
  }, [active, phase, message, restart]);

  const retry = useCallback(() => { retriesRef.current = 0; autoRetryRef.current = false; restart(); }, [restart]);

  let prompt;
  if (phase === 'steady') prompt = AUTO_MESSAGES.steady;
  else if (phase === 'countdown') prompt = `${AUTO_MESSAGES.countdown} — ${count}`;
  else if (phase === 'processing') prompt = AUTO_MESSAGES.processing;
  else if (phase === 'done' || phase === 'error') prompt = message;
  else prompt = message || guidance?.message || '';

  return { phase, count, prompt, message, retry, canRetry: phase === 'error' };
}
