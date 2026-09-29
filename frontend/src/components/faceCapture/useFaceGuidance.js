import { useEffect, useRef, useState } from 'react';
import useFaceDetection from '../scanner/useFaceDetection';

/**
 * Live, client-side coaching for biometric face capture.
 *
 * While the camera is active it samples the video a few times per second,
 * checks the detected face against the on-screen oval (presence, centering,
 * distance) plus overall lighting, and returns one plain-language instruction
 * so the operator always knows the single next thing to fix.
 *
 * status:
 *   'idle'        camera off
 *   'loading'     face guide still starting
 *   'noface'      no face in view
 *   'adjust'      face found but needs repositioning / better light
 *   'ready'       face is well placed; safe to capture
 *   'unavailable' detector could not load; manual alignment only
 */

const TICK_MS = 280;
const DETECTOR_TIMEOUT_MS = 8000;
const READY_STREAK = 2;

// Face box as a fraction of the frame width.
const MIN_FACE_WIDTH = 0.22;
const MAX_FACE_WIDTH = 0.6;
// Allowed offset of the face centre from the frame centre.
const MAX_OFFSET_X = 0.12;
const MAX_OFFSET_Y = 0.14;
// Average luminance (0–255) limits.
const MIN_BRIGHTNESS = 60;
const MAX_BRIGHTNESS = 215;

export const GUIDANCE_MESSAGES = {
  idle: 'Start the camera to begin.',
  loading: 'Starting face guide…',
  noface: 'No face detected. Look straight at the camera.',
  center: 'Please center your face in the frame.',
  raise: 'Please center your face in the frame. Move up slightly.',
  lower: 'Please center your face in the frame. Move down slightly.',
  closer: 'Move closer to the camera.',
  farther: 'Move back a little.',
  dark: 'Too dark. Add light in front of the face.',
  bright: 'Too bright. Avoid strong light on or behind the face.',
  holdStill: 'Hold still…',
  ready: 'Looks good. Hold still and capture.',
  unavailable: 'Center your face inside the oval, then capture.',
};

const STATUS_TONE = {
  idle: 'neutral',
  loading: 'neutral',
  unavailable: 'neutral',
  noface: 'danger',
  adjust: 'warning',
  ready: 'success',
};

/** Colour tone ('success' | 'warning' | 'danger' | 'neutral') for a status. */
export function guidanceTone(status) {
  return STATUS_TONE[status] || 'neutral';
}

/** Capture stays enabled unless the detector is sure there is no face. */
export function canCaptureWith(status) {
  return status !== 'noface' && status !== 'idle';
}

const IDLE_STATE = {
  status: 'idle',
  message: GUIDANCE_MESSAGES.idle,
  checks: { face: 'pending', centered: 'pending', distance: 'pending', lighting: 'pending' },
};

function measureBrightness(video, canvas) {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = 48;
    canvas.height = 36;
    ctx.drawImage(video, 0, 0, 48, 36);
    const { data } = ctx.getImageData(0, 0, 48, 36);
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return total / (data.length / 4);
  } catch {
    return null;
  }
}

/** Pure evaluation step, exported for unit testing. */
export function evaluateFaceFrame({ box, width, height, brightness, detectorReady }) {
  const lighting = brightness == null ? 'pending'
    : brightness < MIN_BRIGHTNESS || brightness > MAX_BRIGHTNESS ? 'bad' : 'ok';
  const lightingKey = brightness != null && brightness < MIN_BRIGHTNESS ? 'dark'
    : brightness != null && brightness > MAX_BRIGHTNESS ? 'bright' : null;

  if (!detectorReady) {
    return {
      status: 'unavailable',
      message: lightingKey ? GUIDANCE_MESSAGES[lightingKey] : GUIDANCE_MESSAGES.unavailable,
      checks: { face: 'pending', centered: 'pending', distance: 'pending', lighting },
    };
  }

  if (!box || !width || !height) {
    return {
      status: 'noface',
      message: GUIDANCE_MESSAGES.noface,
      checks: { face: 'bad', centered: 'pending', distance: 'pending', lighting },
    };
  }

  const faceWidth = (box.right - box.left) / width;
  const offsetX = (box.left + box.right) / 2 / width - 0.5;
  const offsetY = (box.top + box.bottom) / 2 / height - 0.5;

  const distanceKey = faceWidth < MIN_FACE_WIDTH ? 'closer' : faceWidth > MAX_FACE_WIDTH ? 'farther' : null;
  let centerKey = null;
  if (Math.abs(offsetX) > MAX_OFFSET_X) centerKey = 'center';
  else if (offsetY < -MAX_OFFSET_Y) centerKey = 'lower';
  else if (offsetY > MAX_OFFSET_Y) centerKey = 'raise';

  const checks = {
    face: 'ok',
    centered: centerKey ? 'bad' : 'ok',
    distance: distanceKey ? 'bad' : 'ok',
    lighting,
  };

  // One instruction at a time, in the order people naturally fix things.
  const issue = centerKey || distanceKey || lightingKey;
  if (issue) return { status: 'adjust', message: GUIDANCE_MESSAGES[issue], checks };
  return { status: 'ready', message: GUIDANCE_MESSAGES.ready, checks };
}

export default function useFaceGuidance(videoRef, active) {
  const { initLocalFaceDetector, detectLocalFace } = useFaceDetection();
  const [guidance, setGuidance] = useState(IDLE_STATE);
  const lastKeyRef = useRef('');
  const brightnessCanvasRef = useRef(null);

  useEffect(() => {
    if (!active) {
      lastKeyRef.current = '';
      return undefined;
    }

    let cancelled = false;
    let timer = null;
    let detectorReady = false;
    let readyStreak = 0;

    const publish = (next) => {
      const key = `${next.status}|${next.message}|${Object.values(next.checks).join(',')}`;
      if (key === lastKeyRef.current) return;
      lastKeyRef.current = key;
      setGuidance(next);
    };

    publish({ ...IDLE_STATE, status: 'loading', message: GUIDANCE_MESSAGES.loading });

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth) {
        if (!brightnessCanvasRef.current) brightnessCanvasRef.current = document.createElement('canvas');
        const brightness = measureBrightness(video, brightnessCanvasRef.current);
        const box = detectorReady ? await detectLocalFace(video) : null;
        if (cancelled) return;
        let next = evaluateFaceFrame({ box, width: video.videoWidth, height: video.videoHeight, brightness, detectorReady });
        // Require a short streak of good frames so "ready" doesn't flicker.
        if (next.status === 'ready') {
          readyStreak += 1;
          if (readyStreak < READY_STREAK) next = { ...next, status: 'adjust', message: GUIDANCE_MESSAGES.holdStill };
        } else {
          readyStreak = 0;
        }
        publish(next);
      }
      timer = setTimeout(tick, TICK_MS);
    };

    const timeout = new Promise((resolve) => setTimeout(() => resolve(false), DETECTOR_TIMEOUT_MS));
    Promise.race([initLocalFaceDetector(), timeout])
      .then((ok) => { detectorReady = Boolean(ok); })
      .catch(() => { detectorReady = false; })
      .finally(() => { if (!cancelled) tick(); });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, videoRef, initLocalFaceDetector, detectLocalFace]);

  // When the camera is off, always report idle (stale live state is ignored).
  return active ? guidance : IDLE_STATE;
}
