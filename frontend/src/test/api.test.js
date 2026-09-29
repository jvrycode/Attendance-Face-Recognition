import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api, TokenStorage, apiRequest } from '../api';;

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(body),
});

describe('AttendFR API client feature contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
    TokenStorage.clear();
  });

  it('logs in, stores JWTs, and loads the current profile', async () => {
    fetch
      .mockResolvedValueOnce(response({ access: 'access-1', refresh: 'refresh-1' }))
      .mockResolvedValueOnce(response({ username: 'admin', role: 'admin' }));

    const result = await Api.login('admin', 'secret');

    expect(result.user.role).toBe('admin');
    expect(TokenStorage.getAccess()).toBe('access-1');
    expect(TokenStorage.getRefresh()).toBe('refresh-1');
    expect(JSON.parse(localStorage.getItem('attendfr_user')).username).toBe('admin');
    expect(fetch).toHaveBeenNthCalledWith(1, 'http://127.0.0.1:8000/api/token/', expect.objectContaining({ method: 'POST' }));
    expect(fetch).toHaveBeenNthCalledWith(2, 'http://127.0.0.1:8000/api/auth/me/', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer access-1' }) }));
  });

  it('refreshes an expired access token and retries the original request', async () => {
    TokenStorage.set('expired', 'refresh-old', { username: 'teacher' });
    fetch
      .mockResolvedValueOnce(response({ detail: 'token expired' }, 401))
      .mockResolvedValueOnce(response({ access: 'access-new', refresh: 'refresh-new' }))
      .mockResolvedValueOnce(response({ status: 'healthy' }));

    const result = await apiRequest('/api/health/');

    expect(result.ok).toBe(true);
    expect(TokenStorage.getAccess()).toBe('access-new');
    expect(TokenStorage.getRefresh()).toBe('refresh-new');
    expect(fetch).toHaveBeenNthCalledWith(3, 'http://127.0.0.1:8000/api/health/', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer access-new' }) }));
  });

  it('clears credentials when refresh is rejected', async () => {
    TokenStorage.set('expired', 'bad-refresh', { username: 'teacher' });
    fetch.mockResolvedValueOnce(response({}, 401)).mockResolvedValueOnce(response({}, 401));

    await apiRequest('/api/protected/');

    expect(TokenStorage.getAccess()).toBeNull();
    expect(TokenStorage.getRefresh()).toBeNull();
    expect(TokenStorage.getUser()).toBeNull();
  });

  it('maps a closed scanner session without throwing', async () => {
    fetch.mockResolvedValueOnce(response({ session_closed: true, error: 'Session is closed' }, 403));

    await expect(Api.recognizeFace(12, 'frame')).resolves.toEqual({
      success: false,
      session_closed: true,
      error: 'Session is closed',
    });
  });
});

describe('Face enrollment: one student = one face', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
    TokenStorage.clear();
  });

  it('surfaces duplicate_face without retrying', async () => {
    fetch.mockResolvedValueOnce(response({
      success: false, code: 'duplicate_face', message: 'This face is already enrolled to Alice (STU-A).',
      conflict_student: { id: 1, student_id: 'STU-A', name: 'Alice' },
    }, 409));
    const confirm = vi.fn();

    await expect(Api.enrollFaceWithConfirm(2, 'frame', confirm)).rejects.toMatchObject({
      code: 'duplicate_face', conflictStudent: { student_id: 'STU-A' },
    });
    expect(confirm).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('retries with replace=true only after the admin confirms a face_mismatch', async () => {
    fetch
      .mockResolvedValueOnce(response({ success: false, code: 'face_mismatch', message: 'Does not match.' }, 409))
      .mockResolvedValueOnce(response({ success: true, message: 'Face enrolled' }));

    const result = await Api.enrollFaceWithConfirm(1, 'frame', () => true);

    expect(result.success).toBe(true);
    expect(JSON.parse(fetch.mock.calls[0][1].body).replace).toBeUndefined();
    expect(JSON.parse(fetch.mock.calls[1][1].body).replace).toBe(true);
  });

  it('does not replace when the admin cancels', async () => {
    fetch.mockResolvedValueOnce(response({ success: false, code: 'face_mismatch', message: 'Does not match.' }, 409));

    await expect(Api.enrollFaceWithConfirm(1, 'frame', () => false)).rejects.toMatchObject({ code: 'face_mismatch' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('Session end and refresh', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
    TokenStorage.clear();
  });

  it('logout clears local tokens and asks the server to revoke them', async () => {
    TokenStorage.set('access-1', 'refresh-1', { username: 'u' });
    fetch.mockResolvedValueOnce(response({ success: true }));

    await Api.logout();

    expect(TokenStorage.getAccess()).toBeNull();
    expect(TokenStorage.getRefresh()).toBeNull();
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8000/api/auth/logout/');
    expect(options.headers.Authorization).toBe('Bearer access-1');
    expect(JSON.parse(options.body).refresh).toBe('refresh-1');
  });

  it('parallel 401s share a single refresh call (refresh tokens are single-use)', async () => {
    TokenStorage.set('expired', 'refresh-old', { username: 'u' });
    fetch.mockImplementation(async (url, options) => {
      if (url.endsWith('/api/token/refresh/')) return response({ access: 'access-new', refresh: 'refresh-new' });
      return options?.headers?.Authorization === 'Bearer access-new' ? response({ ok: true }) : response({}, 401);
    });

    const results = await Promise.all([apiRequest('/api/a/'), apiRequest('/api/b/'), apiRequest('/api/c/')]);

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/api/token/refresh/'))).toHaveLength(1);
    expect(TokenStorage.getRefresh()).toBe('refresh-new');
  });
});
