import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useAutoFaceCapture, { AUTO_MESSAGES, FRAME_COUNT, isFaceGood, isFaceLost } from '../components/faceCapture/useAutoFaceCapture';
import { GUIDANCE_MESSAGES } from '../components/faceCapture/useFaceGuidance';
import { Api, TokenStorage } from '../api';

const READY = { status: 'ready', message: GUIDANCE_MESSAGES.ready };
const NOFACE = { status: 'noface', message: GUIDANCE_MESSAGES.noface };
const video = { videoWidth: 640, videoHeight: 480 };

function setup({ guidance = READY, onSubmit = vi.fn().mockResolvedValue({ message: 'Face enrolled!' }) } = {}) {
  const onFlash = vi.fn();
  const hook = renderHook((props) => useAutoFaceCapture(props), {
    initialProps: { active: true, guidance, videoRef: { current: video }, onSubmit, onFlash },
  });
  return { ...hook, onSubmit, onFlash };
}

// Step in small slices so React re-renders (and schedules the next timer) between ticks.
const advance = async (ms) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    await act(async () => { await vi.advanceTimersByTimeAsync(Math.min(100, ms - elapsed)); });
  }
};

describe('hands-free face capture', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('hold steady -> 3, 2, 1 -> processing -> done, sending one frame per count', async () => {
    const { result, onSubmit, onFlash } = setup();
    expect(result.current.phase).toBe('steady');
    expect(result.current.prompt).toBe(AUTO_MESSAGES.steady);

    await advance(900);
    expect(result.current.phase).toBe('countdown');
    expect(result.current.count).toBe(3);
    await advance(1000);
    expect(result.current.count).toBe(2);
    await advance(1000);
    expect(result.current.count).toBe(1);
    await advance(1000);

    expect(onFlash).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toHaveLength(FRAME_COUNT);
    expect(result.current.phase).toBe('done');
    expect(result.current.prompt).toBe('Face enrolled!');
  });

  it('never captures without a face', async () => {
    const { result, onSubmit } = setup({ guidance: NOFACE });
    await advance(10000);
    expect(result.current.phase).toBe('waiting');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('restarts the countdown if the student moves away', async () => {
    const { result, rerender, onSubmit } = setup();
    await advance(900 + 1000); // countdown at 2
    rerender({ active: true, guidance: NOFACE, videoRef: { current: video }, onSubmit, onFlash: vi.fn() });
    await advance(1000);
    expect(result.current.phase).toBe('waiting');
    expect(result.current.prompt).toBe(AUTO_MESSAGES.moved);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('retries by itself after a quality rejection', async () => {
    const onSubmit = vi.fn()
      .mockRejectedValueOnce(new Error('Photo 2: Photo is blurry.'))
      .mockResolvedValueOnce({ message: 'ok' });
    const { result } = setup({ onSubmit });
    await advance(900 + 3000);
    expect(result.current.phase).toBe('error');
    expect(result.current.prompt).toContain('blurry');
    await advance(2500 + 900 + 3000);
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(result.current.phase).toBe('done');
  });

  it('stops and waits for "Try again" when a person must act (e.g. duplicate face)', async () => {
    const duplicate = Object.assign(new Error('This face is already enrolled to Alice.'), { code: 'duplicate_face' });
    const onSubmit = vi.fn().mockRejectedValue(duplicate);
    const { result } = setup({ onSubmit });
    await advance(900 + 3000 + 10000);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(result.current.canRetry).toBe(true);
    act(() => result.current.retry());
    expect(result.current.phase).not.toBe('error');
  });

  it('classifies guidance states', () => {
    expect(isFaceGood(READY)).toBe(true);
    expect(isFaceGood({ status: 'unavailable' })).toBe(true);
    expect(isFaceLost(NOFACE)).toBe(true);
    expect(isFaceLost({ status: 'adjust', message: GUIDANCE_MESSAGES.holdStill })).toBe(false);
    expect(isFaceLost({ status: 'adjust', message: GUIDANCE_MESSAGES.closer })).toBe(true);
  });
});

describe('enroll API payload', () => {
  it('sends all countdown frames as "frames"', async () => {
    TokenStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
    await Api.enrollFace(5, ['a', 'b', 'c']);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ student_id: 5, frames: ['a', 'b', 'c'] });
  });
});
