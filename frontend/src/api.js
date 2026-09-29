/**
 * AttendFR REST API Client
 * Seamlessly interfaces with Django REST Framework backend on Render / Localhost.
 */
import { formatErrorMessage } from './utils/errorMessages';
import { beginRequest } from './ui/loadingStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export function getApiBaseUrl() {
  return API_BASE_URL.replace(/\/+$/, '');
}

export function resolveMediaUrl(value) {
  if (!value) return '';
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) return value;
  return `${getApiBaseUrl()}${value.startsWith('/') ? value : `/${value}`}`;
}

export const TokenStorage = {
  getAccess: () => localStorage.getItem('attendfr_access_token'),
  getRefresh: () => localStorage.getItem('attendfr_refresh_token'),
  getUser: () => {
    try {
      const u = localStorage.getItem('attendfr_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  set: (access, refresh, user) => {
    if (access) localStorage.setItem('attendfr_access_token', access);
    if (refresh) localStorage.setItem('attendfr_refresh_token', refresh);
    if (user) localStorage.setItem('attendfr_user', JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem('attendfr_access_token');
    localStorage.removeItem('attendfr_refresh_token');
    localStorage.removeItem('attendfr_user');
  },
};

/**
 * All requests go through here so the global loader (top progress bar and
 * automatic button spinners) stays in sync. Pass `{ background: true }` for
 * polling-style calls that should never show a loading indicator.
 */
export async function apiRequest(endpoint, options = {}) {
  const { background = false, ...fetchOptions } = options;
  const endLoading = beginRequest({ background });
  try {
    return await performRequest(endpoint, fetchOptions);
  } finally {
    endLoading();
  }
}

async function performRequest(endpoint, options) {
  const url = `${getApiBaseUrl()}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = TokenStorage.getAccess();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, { ...options, headers });

  // Handle Token Expiry & Automatic Refresh
  if (response.status === 401 && TokenStorage.getRefresh()) {
    const newAccess = await refreshAccessToken();
    if (newAccess) {
      headers['Authorization'] = `Bearer ${newAccess}`;
      response = await fetch(url, { ...options, headers });
    }
  }

  return response;
}

// Refresh tokens are single-use on the server, so concurrent 401s must share ONE
// refresh call; otherwise the second call would be rejected and log the user out.
let refreshInFlight = null;

function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  const refresh = TokenStorage.getRefresh();
  refreshInFlight = (async () => {
    try {
      const refreshRes = await fetch(`${getApiBaseUrl()}/api/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        TokenStorage.set(data.access, data.refresh || null, null);
        return data.access;
      }
      if (refreshRes.status === 401 || refreshRes.status === 400) {
        TokenStorage.clear();
      }
      return null;
    } catch {
      // Network failure during refresh - avoid wiping stored credentials on transient offline state
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export const Api = {
  // Auth
  login: async (username, password) => {
    const endLoading = beginRequest();
    let res;
    try {
      res = await fetch(`${getApiBaseUrl()}/api/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } finally {
      endLoading();
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(formatErrorMessage(err.detail || err.error || 'Invalid credentials'));
    }
    const data = await res.json();
    TokenStorage.set(data.access, data.refresh, null);

    // Fetch user profile immediately
    const meRes = await apiRequest('/api/auth/me/');
    if (meRes.ok) {
      const meData = await meRes.json();
      TokenStorage.set(data.access, data.refresh, meData);
      return { tokens: data, user: meData };
    }
    return { tokens: data, user: null };
  },

  /**
   * Clears local tokens immediately, then asks the server to revoke them so a copied
   * token stops working too. Returns the revoke promise (callers need not await it).
   */
  logout: () => {
    const refresh = TokenStorage.getRefresh();
    const access = TokenStorage.getAccess();
    TokenStorage.clear();
    if (!refresh && !access) return Promise.resolve();
    return fetch(`${getApiBaseUrl()}/api/auth/logout/`, {
      method: 'POST',
      keepalive: true, // still sent if the page is closing
      headers: {
        'Content-Type': 'application/json',
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
      },
      body: JSON.stringify({ refresh }),
    }).catch(() => {
      // Offline: local tokens are already gone; the server copy expires on its own.
    });
  },

  getMe: async () => {
    const res = await apiRequest('/api/auth/me/');
    if (!res.ok) throw new Error('Failed to load user profile');
    return res.json();
  },

  getDashboardStats: async () => {
    const res = await apiRequest('/api/dashboard/stats/');
    if (!res.ok) throw new Error('Failed to load dashboard statistics');
    return res.json();
  },

  // Users Management
  getUsers: async (role = null, search = '') => {
    const params = new URLSearchParams();
    if (role && role !== 'all') params.append('role', role);
    if (search) params.append('search', search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await apiRequest(`/api/users/${qs}`);
    if (!res.ok) return [];
    return res.json();
  },

  createUser: async (userData) => {
    const res = await apiRequest('/api/users/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(formatErrorMessage(err));
    }
    return res.json();
  },

  updateUser: async (id, userData) => {
    const res = await apiRequest(`/api/users/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(formatErrorMessage(err));
    }
    return res.json();
  },

  deleteUser: async (id) => {
    const res = await apiRequest(`/api/users/${id}/`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(formatErrorMessage(err));
    }
    return true;
  },

  // Academic Catalog
  getPrograms: async () => {
    const res = await apiRequest('/api/programs/');
    if (!res.ok) return [];
    return res.json();
  },

  createProgram: async (programData) => {
    const res = await apiRequest('/api/programs/', {
      method: 'POST',
      body: JSON.stringify(programData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to create program');
    }
    return res.json();
  },

  getCourses: async (programId = null) => {
    const q = programId ? `?program=${encodeURIComponent(programId)}` : '';
    const res = await apiRequest(`/api/courses/${q}`);
    if (!res.ok) return [];
    return res.json();
  },

  createCourse: async (courseData) => {
    const res = await apiRequest('/api/courses/', {
      method: 'POST',
      body: JSON.stringify(courseData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to create course');
    }
    return res.json();
  },

  updateCourse: async (id, courseData) => {
    const res = await apiRequest(`/api/courses/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(courseData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to update course');
    }
    return res.json();
  },

  deleteCourse: async (id) => {
    const res = await apiRequest(`/api/courses/${id}/`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete course');
    return true;
  },

  getSections: async (filters = null) => {
    const params = new URLSearchParams();
    if (filters && typeof filters === 'object') {
      if (filters.program_id) params.append('program_id', filters.program_id);
      if (filters.course_id) params.append('course_id', filters.course_id);
      if (filters.section_id) params.append('section_id', filters.section_id);
      if (filters.subject_id) params.append('subject_id', filters.subject_id);
      if (filters.year_level) params.append('year_level', filters.year_level);
    }
    const query = params.toString();
    const res = await apiRequest(`/api/sections/${query ? `?${query}` : ''}`);
    if (!res.ok) return [];
    return res.json();
  },

  createSection: async (sectionData) => {
    const res = await apiRequest('/api/sections/', {
      method: 'POST',
      body: JSON.stringify(sectionData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to create section');
    }
    return res.json();
  },

  getSchedules: async (sectionId = null) => {
    const q = sectionId ? `?section_id=${sectionId}` : '';
    const res = await apiRequest(`/api/schedules/${q}`);
    if (!res.ok) return [];
    return res.json();
  },

  createSchedule: async (scheduleData) => {
    const res = await apiRequest('/api/schedules/', {
      method: 'POST',
      body: JSON.stringify(scheduleData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to create schedule');
    }
    return res.json();
  },

  updateSchedule: async (id, scheduleData) => {
    const res = await apiRequest(`/api/schedules/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(scheduleData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || (Array.isArray(err) ? err[0] : 'Failed to update schedule'));
    }
    return res.json();
  },

  getProgramSections: async (filters = null) => {
    let q = '';
    if (typeof filters === 'number' || (typeof filters === 'string' && filters)) {
      q = `?program=${filters}`;
    } else if (filters && typeof filters === 'object') {
      const params = new URLSearchParams();
      if (filters.program_id || filters.program) params.append('program_id', filters.program_id || filters.program);
      if (filters.course_id || filters.course) params.append('course_id', filters.course_id || filters.course);
      if (filters.section_id || filters.section) params.append('section_id', filters.section_id || filters.section);
      if (filters.year_level) params.append('year_level', filters.year_level);
      const str = params.toString();
      if (str) q = `?${str}`;
    }
    const res = await apiRequest(`/api/program-sections/${q}`);
    if (!res.ok) return [];
    return res.json();
  },

  createProgramSection: async (sectionData) => {
    const res = await apiRequest('/api/program-sections/', {
      method: 'POST',
      body: JSON.stringify(sectionData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to create section definition');
    }
    return res.json();
  },

  getSubjects: async (filters = null) => {
    const params = new URLSearchParams();
    if (filters && typeof filters === 'object') {
      if (filters.program_id) params.append('program_id', filters.program_id);
      if (filters.course_id) params.append('course_id', filters.course_id);
      if (filters.section_id) params.append('section_id', filters.section_id);
    }
    const query = params.toString();
    const res = await apiRequest(`/api/subjects/${query ? `?${query}` : ''}`);
    if (!res.ok) return [];
    return res.json();
  },

  createSubject: async (subjectData) => {
    const res = await apiRequest('/api/subjects/', {
      method: 'POST',
      body: JSON.stringify(subjectData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to create subject offering');
    }
    return res.json();
  },

  updateSubject: async (id, subjectData) => {
    const res = await apiRequest(`/api/subjects/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(subjectData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to update subject');
    }
    return res.json();
  },

  updateProgram: async (id, programData) => {
    const res = await apiRequest(`/api/programs/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(programData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to update program');
    }
    return res.json();
  },

  updateSection: async (id, sectionData) => {
    const res = await apiRequest(`/api/sections/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(sectionData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to update section');
    }
    return res.json();
  },

  deleteProgram: async (id) => {
    const res = await apiRequest(`/api/programs/${id}/`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete program');
    return true;
  },

  updateProgramSection: async (id, sectionData) => {
    const res = await apiRequest(`/api/program-sections/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(sectionData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(formatErrorMessage(err.detail || err.error ? (err.detail || err.error) : err) || 'Failed to update section definition');
    }
    return res.json();
  },

  deleteProgramSection: async (id) => {
    const res = await apiRequest(`/api/program-sections/${id}/`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete section definition');
    return true;
  },

  deleteSection: async (id) => {
    const res = await apiRequest(`/api/sections/${id}/`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete section');
    return true;
  },

  getSectionEnrollments: async (sectionId, filters = null) => {
    const params = new URLSearchParams();
    if (filters && typeof filters === 'object' && filters.subject_id) params.append('subject_id', filters.subject_id);
    const query = params.toString();
    const res = await apiRequest(`/api/sections/${sectionId}/enrollments/${query ? `?${query}` : ''}`);
    if (!res.ok) return [];
    return res.json();
  },

  enrollStudent: async (sectionId, studentId, subjectId = null) => {
    const res = await apiRequest(`/api/sections/${sectionId}/enrollments/`, {
      method: 'POST',
      body: JSON.stringify({
        student_id: Number(studentId),
        student: Number(studentId),
        subject_id: subjectId ? Number(subjectId) : null,
        subject: subjectId ? Number(subjectId) : null,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error || err.detail || (err.student_id ? err.student_id[0] : null) || 'Failed to enroll student';
      throw new Error(msg);
    }
    return res.json();
  },

  unenrollStudent: async (sectionId, enrollmentId) => {
    const res = await apiRequest(`/api/sections/${sectionId}/enrollments/${enrollmentId}/`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.detail || 'Failed to unenroll student');
    }
    return true;
  },

  deleteSchedule: async (id) => {
    const res = await apiRequest(`/api/schedules/${id}/`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete schedule');
    return true;
  },

  deleteSubject: async (id) => {
    const res = await apiRequest(`/api/subjects/${id}/`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete subject');
    return true;
  },

  getTeachers: async () => {
    const res = await apiRequest('/api/users/?role=teacher');
    if (!res.ok) return [];
    return res.json();
  },

  getStudents: async (search = '') => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await apiRequest(`/api/students/${q}`);
    if (!res.ok) return [];
    return res.json();
  },

  getNextStudentId: async () => {
    const res = await apiRequest('/api/students/next-id/');
    if (!res.ok) return { next_student_id: '' };
    return res.json();
  },

  updateProfile: async (profileData) => {
    const res = await apiRequest('/api/auth/me/', {
      method: 'PATCH',
      body: JSON.stringify(profileData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || err.error || 'Failed to update profile');
    }
    const data = await res.json();
    TokenStorage.set(null, null, data);
    return data;
  },

  // Attendance Sessions
  getSessions: async () => {
    const res = await apiRequest('/api/attendance/sessions/');
    if (!res.ok) return [];
    return res.json();
  },

  startSession: async (scheduleId) => {
    const res = await apiRequest('/api/attendance/sessions/start/', {
      method: 'POST',
      body: JSON.stringify({ schedule_id: scheduleId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to start session');
    }
    return res.json();
  },

  closeSession: async (sessionId) => {
    const res = await apiRequest(`/api/attendance/sessions/${sessionId}/close/`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to close session');
    return res.json();
  },

  reopenSession: async (sessionId, reason) => {
    const res = await apiRequest(`/api/attendance/sessions/${sessionId}/reopen/`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to reopen attendance session');
    }
    return res.json();
  },

  getSessionDetail: async (sessionId) => {
    const res = await apiRequest(`/api/attendance/sessions/${sessionId}/`);
    if (!res.ok) throw new Error('Failed to load session details');
    return res.json();
  },

  // Face Recognition & Enrollment
  recognizeFace: async (sessionId, frameBase64) => {
    const res = await apiRequest('/api/face/recognize/', {
      background: true,
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, frame: frameBase64 }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.session_closed) {
        return { success: false, session_closed: true, error: err.error };
      }
      if (err.attendance_unavailable) {
        return { success: false, attendance_unavailable: true, error: err.error };
      }
      throw new Error(err.error || 'Face recognition service error');
    }
    return res.json();
  },

  /**
   * Enroll a student's face. Pass `{ replace: true }` only after the admin confirms
   * replacing a face that does not match the one already enrolled.
   * Errors carry `code`: 'duplicate_face' (face belongs to another student) or
   * 'face_mismatch' (different person than this student's current face).
   */
  enrollFace: async (studentId, frames, { replace = false } = {}) => {
    // The server builds one face identity from 3-5 photos of the same student.
    const list = Array.isArray(frames) ? frames : [frames];
    const res = await apiRequest('/api/face/enroll/', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, frames: list, ...(replace ? { replace: true } : {}) }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const error = new Error(err.error || err.message || 'Face enrollment failed');
      error.code = err.code || null;
      error.conflictStudent = err.conflict_student || null;
      throw error;
    }
    return res.json();
  },

  /** Enroll a face; if it differs from the student's current face, ask before replacing. */
  enrollFaceWithConfirm: async (studentId, frames, confirmReplace = (message) => window.confirm(message)) => {
    try {
      return await Api.enrollFace(studentId, frames);
    } catch (error) {
      if (error.code === 'face_mismatch' && confirmReplace(`${error.message}\n\nReplace the existing face?`)) {
        return Api.enrollFace(studentId, frames, { replace: true });
      }
      throw error;
    }
  },
  markAttendance: async (sessionId, studentId, status = 'present') => {
    const res = await apiRequest('/api/attendance/records/mark/', {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, student_id: studentId, status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to mark attendance');
    }
    return res.json();
  },

  // Student Attendance Overview & Monthly Calendar
  getStudentAttendanceOverview: async (studentId = null) => {
    let endpoint = '/api/attendance/student/overview/';
    if (studentId) endpoint += `?student_id=${studentId}`;
    const res = await apiRequest(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to load student attendance overview');
    }
    return res.json();
  },

  getStudentAttendanceCalendar: async (sectionId, year = null, month = null, studentId = null) => {
    let endpoint = `/api/attendance/student/calendar/${sectionId}/?format=json`;
    if (year && month) endpoint += `&year=${year}&month=${month}`;
    if (studentId) endpoint += `&student_id=${studentId}`;
    const res = await apiRequest(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to load attendance calendar');
    }
    return res.json();
  },
};

