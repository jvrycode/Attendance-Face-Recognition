import { describe, expect, it } from 'vitest';
import { evaluateFaceFrame, GUIDANCE_MESSAGES, canCaptureWith } from '../components/faceCapture/useFaceGuidance';
import { cleanToastMessage } from '../utils/toastText';

const frame = { width: 640, height: 480, brightness: 120, detectorReady: true };
const box = (cx, cy, w) => ({ left: cx - w / 2, right: cx + w / 2, top: cy - w * 0.65, bottom: cy + w * 0.65 });

describe('evaluateFaceFrame', () => {
  it('reports no face when nothing is detected', () => {
    const result = evaluateFaceFrame({ ...frame, box: null });
    expect(result.status).toBe('noface');
    expect(result.message).toBe(GUIDANCE_MESSAGES.noface);
    expect(canCaptureWith(result.status)).toBe(false);
  });

  it('asks the user to center an off-center face', () => {
    const result = evaluateFaceFrame({ ...frame, box: box(120, 240, 200) });
    expect(result.status).toBe('adjust');
    expect(result.message).toBe('Please center your face in the frame.');
    expect(result.checks.centered).toBe('bad');
  });

  it('asks to move closer or back based on face size', () => {
    expect(evaluateFaceFrame({ ...frame, box: box(320, 240, 90) }).message).toBe(GUIDANCE_MESSAGES.closer);
    expect(evaluateFaceFrame({ ...frame, box: box(320, 240, 420) }).message).toBe(GUIDANCE_MESSAGES.farther);
  });

  it('flags poor lighting', () => {
    expect(evaluateFaceFrame({ ...frame, brightness: 30, box: box(320, 240, 200) }).message).toBe(GUIDANCE_MESSAGES.dark);
  });

  it('is ready when centered, sized, and lit', () => {
    const result = evaluateFaceFrame({ ...frame, box: box(320, 240, 200) });
    expect(result.status).toBe('ready');
    expect(Object.values(result.checks).every((check) => check === 'ok')).toBe(true);
  });

  it('falls back to manual alignment when the detector is unavailable', () => {
    const result = evaluateFaceFrame({ ...frame, detectorReady: false, box: null });
    expect(result.status).toBe('unavailable');
    expect(canCaptureWith(result.status)).toBe(true);
  });
});

describe('cleanToastMessage', () => {
  it('removes filler wording and exclamation marks', () => {
    expect(cleanToastMessage('Class schedule created successfully!')).toBe('Class schedule created.');
    expect(cleanToastMessage('Subject "IT101" updated successfully!')).toBe('Subject "IT101" updated.');
    expect(cleanToastMessage('failed to delete course')).toBe('Failed to delete course.');
    expect(cleanToastMessage('')).toBe('');
  });
});
