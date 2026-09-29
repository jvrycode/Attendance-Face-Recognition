import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useScannerSession from '../components/scanner/useScannerSession';
import { Api } from '../api';

vi.mock('../api', () => ({ Api: { getSessions: vi.fn(), getSessionDetail: vi.fn() } }));

describe('scanner session workflow', () => {
  it('selects the requested session and seeds already-marked students', async () => {
    Api.getSessions.mockResolvedValue([
      { id: 1, status: 'open' },
      { id: 2, status: 'closed' },
    ]);
    Api.getSessionDetail.mockResolvedValue({
      session: { id: 2, status: 'closed' },
      records: [{ student: 17, status: 'present' }, { student: 18, status: 'absent' }],
    });

    const { result } = renderHook(() => useScannerSession(2));

    await waitFor(() => expect(result.current.session?.id).toBe(2));
    expect(result.current.records).toHaveLength(2);
    expect(result.current.markedStudentIdsRef.current.has(17)).toBe(true);
    expect(result.current.markedStudentIdsRef.current.has(18)).toBe(false);
    expect(Api.getSessionDetail).toHaveBeenCalledWith(2);
  });
});


  it('does not fall back to an unrelated session when the requested session is missing', async () => {
    Api.getSessions.mockResolvedValue([{ id: 1, status: 'open' }]);
    const { result } = renderHook(() => useScannerSession(999));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
    expect(Api.getSessionDetail).not.toHaveBeenCalled();
  });
