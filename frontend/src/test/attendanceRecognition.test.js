import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useAttendanceRecognition from '../components/scanner/useAttendanceRecognition';
import { Api } from '../api';

vi.mock('../api', () => ({ Api: { recognizeFace: vi.fn(), markAttendance: vi.fn() } }));

function createProps() {
  return {
    session: { id: 7 },
    setSession: vi.fn(),
    videoRef: { current: { videoWidth: 640, videoHeight: 480 } },
    captureCanvasRef: { current: { getContext: () => ({ drawImage: vi.fn() }), toDataURL: () => 'frame' } },
    setRecords: vi.fn(),
    setStatusText: vi.fn(),
    setStatusState: vi.fn(),
    markedStudentIdsRef: { current: new Set() },
    setJustMarkedId: vi.fn(),
    stopCamera: vi.fn(),
    playAttendanceChime: vi.fn(),
    overlayStateRef: { current: 'idle' },
    overlayLabelRef: { current: '' },
    faceBoxTargetRef: { current: null },
    lastFaceSeenRef: { current: 0 },
  };
}

describe('scanner recognition workflow', () => {
  it('updates attendance state after a matched face', () => {
    const props = createProps();
    const { result } = renderHook(() => useAttendanceRecognition(props));

    act(() => result.current.applyRecognition({ recognized: [{ student_id: 21, name: 'Ada Lovelace', matched: true, new_status: 'late' }] }, 640, 480));

    expect(props.setStatusText).toHaveBeenCalledWith('Recorded Late: Ada Lovelace');
    expect(props.setStatusState).toHaveBeenCalledWith('success');
    expect(props.markedStudentIdsRef.current.has(21)).toBe(true);
    expect(props.setRecords).toHaveBeenCalled();
  });

  it('shows the head-turn challenge prompt and does not mark yet', () => {
    const props = createProps();
    const { result } = renderHook(() => useAttendanceRecognition(props));

    act(() => result.current.applyRecognition({ recognized: [{
      student_id: 21, name: 'Ada Lovelace', matched: false, verifying: true,
      challenge: { type: 'turn_head', direction: 'any', message: 'Turn your head slightly to the left or right' },
    }] }, 640, 480));

    expect(props.setStatusText).toHaveBeenCalledWith('Ada Lovelace: Turn your head slightly to the left or right');
    expect(props.setStatusState).toHaveBeenCalledWith('verifying');
    expect(props.markedStudentIdsRef.current.has(21)).toBe(false);
    expect(props.setRecords).not.toHaveBeenCalled();
  });

  it('shows the server reason when liveness fails', () => {
    const props = createProps();
    const { result } = renderHook(() => useAttendanceRecognition(props));

    act(() => result.current.applyRecognition({ recognized: [{
      student_id: 21, name: 'Ada', liveness_failed: true, message: 'Head turn not detected in time.',
    }] }, 640, 480));

    expect(props.setStatusText).toHaveBeenCalledWith('Head turn not detected in time.');
    expect(props.setStatusState).toHaveBeenCalledWith('error');
  });

  it('marks a student manually through the current session API', async () => {
    const props = createProps();
    Api.markAttendance.mockResolvedValue({ success: true, student_name: 'Ada Lovelace' });
    const { result } = renderHook(() => useAttendanceRecognition(props));

    await act(async () => result.current.markAttendance(21, 'present'));

    expect(Api.markAttendance).toHaveBeenCalledWith(7, 21, 'present');
    expect(props.setStatusText).toHaveBeenCalledWith('Recorded: Ada Lovelace');
    expect(props.setRecords).toHaveBeenCalled();
  });
});
