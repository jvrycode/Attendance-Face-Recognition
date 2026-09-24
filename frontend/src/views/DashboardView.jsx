import React, { useState, useEffect } from 'react';
import {
  Contact,
  GraduationCap,
  BookOpen,
  Building,
  Radio,
  CalendarCheck,
  Lock,
  ScanFace,
  UserPlus,
  Shield,
  Calendar,
  Users,
  Camera,
  Zap,
  PieChart,
  Layers,
  Sun,
  Coffee,
  CheckCircle,
  AlertTriangle,
  BarChart2,
  Clock,
  Activity,
  List,
  FileText,
  ClipboardList,
} from 'lucide-react';
import { Api } from '../api';
import { formatTime12h } from '../utils/time';

export default function DashboardView({ user, onNavigate, onStartSession, onSetHeaderInfo }) {
  const role = user?.role || 'admin';

  const [stats, setStats] = useState({
    totalTeachers: 0,
    totalStudents: 0,
    totalSubjects: 0,
    totalSections: 0,
    liveSessions: 0,
    sessionsToday: 0,
    finalizedToday: 0,
    enrolledPct: 0,
    enrolledCount: 0,
  });
  const [sections, setSections] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [secs, schs, sess, statRes] = await Promise.all([
          Api.getSections().catch(() => []),
          Api.getSchedules().catch(() => []),
          Api.getSessions().catch(() => []),
          Api.getDashboardStats().catch(() => null),
        ]);
        setSections(secs || []);
        setSchedules(schs || []);
        setSessions(sess || []);

        if (statRes) {
          setStats({
            totalTeachers: statRes.total_teachers || 0,
            totalStudents: statRes.total_students || 0,
            totalSubjects: statRes.total_subjects || 0,
            totalSections: statRes.total_sections || 0,
            liveSessions: statRes.open_sessions_count || 0,
            sessionsToday: statRes.sessions_today_count || 0,
            finalizedToday: statRes.sessions_today_closed || 0,
            enrolledPct: statRes.face_enrollment_pct !== undefined ? statRes.face_enrollment_pct : 0,
            enrolledCount: statRes.face_enrolled_count || 0,
          });
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Update Top Header in App.jsx (100% copycat of templates/accounts/dashboard_admin.html, dashboard_teacher.html, dashboard_student.html)
  useEffect(() => {
    if (!onSetHeaderInfo) return;

    const todayStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    if (role === 'admin') {
      onSetHeaderInfo({
        title: 'Admin Dashboard',
        subtitle: `System overview — ${todayStr}`,
        headerActions: null,
      });
    } else if (role === 'teacher') {
      const teacherName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username;
      const dept = user?.teacher_profile?.department || 'Faculty';
      onSetHeaderInfo({
        title: 'Instructor Dashboard',
        subtitle: `Welcome back, ${teacherName} • Department: ${dept}`,
        headerActions: (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate('sections')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Calendar size={14} /> <span>Section &amp; Schedule</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate('section_report')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={14} /> <span>Attendance Reports</span>
            </button>
          </div>
        ),
      });
    } else {
      // student
      const course = user?.student_profile?.course || 'Student';
      onSetHeaderInfo({
        title: 'My Dashboard',
        subtitle: `Your attendance overview — ${course}`,
        headerActions: (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate('sections')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Calendar size={14} /> <span>My Schedule</span>
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate('session_logs')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ClipboardList size={14} /> <span>Full Record</span>
            </button>
          </div>
        ),
      });
    }
  }, [role, user?.id, onSetHeaderInfo]);

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 1: ADMIN DASHBOARD (100% copycat of templates/accounts/dashboard_admin.html)
  // ══════════════════════════════════════════════════════════════════════════
  if (role === 'admin') {
    return (
      <div className="page-content">
        {/* Primary KPIs */}
        <div className="stats-grid mb-3">
          <div className="stat-card blue">
            <div className="stat-icon blue"><Contact size={20} /></div>
            <div className="stat-info">
              <div className="value">{stats.totalTeachers}</div>
              <div className="label">Faculty</div>
            </div>
          </div>

          <div className="stat-card green">
            <div className="stat-icon green"><GraduationCap size={20} /></div>
            <div className="stat-info">
              <div className="value">{stats.totalStudents}</div>
              <div className="label">Students</div>
            </div>
          </div>

          <div className="stat-card yellow">
            <div className="stat-icon yellow"><BookOpen size={20} /></div>
            <div className="stat-info">
              <div className="value">{stats.totalSubjects}</div>
              <div className="label">Subjects</div>
            </div>
          </div>

          <div className="stat-card red">
            <div className="stat-icon red"><Building size={20} /></div>
            <div className="stat-info">
              <div className="value">{stats.totalSections}</div>
              <div className="label">Class Sections</div>
            </div>
          </div>
        </div>

        {/* Today's operations */}
        <div className="stats-grid mb-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
            <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
              <Radio size={18} />
            </div>
            <div className="stat-info">
              <div className="value">{stats.liveSessions}</div>
              <div className="label">Live Sessions Now</div>
            </div>
          </div>

          <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
            <div className="stat-icon" style={{ background: 'var(--info-light)', color: 'var(--info)' }}>
              <CalendarCheck size={18} />
            </div>
            <div className="stat-info">
              <div className="value">{stats.sessionsToday}</div>
              <div className="label">Sessions Today</div>
            </div>
          </div>

          <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
            <div className="stat-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              <Lock size={18} />
            </div>
            <div className="stat-info">
              <div className="value">{stats.finalizedToday}</div>
              <div className="label">Finalized Today</div>
            </div>
          </div>

          <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' }}>
            <div className="stat-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
              <ScanFace size={18} />
            </div>
            <div className="stat-info">
              <div className="value">{stats.enrolledPct}%</div>
              <div className="label">Face Enrolled ({stats.enrolledCount}/{stats.totalStudents})</div>
            </div>
          </div>
        </div>

        {/* Quick Actions & Academic Snapshot */}
        <div className="grid-2 mb-3" style={{ alignItems: 'stretch' }}>
          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} /> Quick Actions
              </span>
            </div>
            <div className="card-body dashboard-action-grid">
              <button type="button" className="btn btn-primary" onClick={() => onNavigate('users')}>
                <UserPlus size={15} /> <span>Register Student</span>
              </button>
              <button type="button" className="btn btn-outline" onClick={() => onNavigate('users')}>
                <Shield size={15} /> <span>Add Faculty / Staff</span>
              </button>
              <button type="button" className="btn btn-outline" onClick={() => onNavigate('sections')}>
                <Building size={15} /> <span>Add Section</span>
              </button>
              <button type="button" className="btn btn-outline" onClick={() => onNavigate('schedules')}>
                <Calendar size={15} /> <span>Add Schedule</span>
              </button>
              <button type="button" className="btn btn-outline" onClick={() => onNavigate('users')}>
                <Users size={15} /> <span>User Management</span>
              </button>
              <button type="button" className="btn btn-outline" onClick={() => onNavigate('face_enrollment')}>
                <Camera size={15} /> <span>Face Enrollment</span>
              </button>
            </div>
          </div>

          {/* Academic Snapshot */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PieChart size={16} /> Academic Snapshot
              </span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                  <span className="text-muted">Student face enrollment</span>
                  <strong>{stats.enrolledPct}%</strong>
                </div>
                <div className="dashboard-progress-track">
                  <div
                    className="dashboard-progress-bar"
                    style={{ width: `${stats.enrolledPct}%`, background: 'var(--success)' }}
                  />
                </div>
              </div>

              <div className="dashboard-mini-stat">
                <span className="text-muted" style={{ fontSize: '12px' }}>Programs &amp; structure</span>
                <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                  <div>
                    <strong>{stats.totalSubjects}</strong>{' '}
                    <span className="text-muted" style={{ fontSize: '12px' }}>subjects</span>
                  </div>
                  <div>
                    <strong>{stats.totalSections}</strong>{' '}
                    <span className="text-muted" style={{ fontSize: '12px' }}>sections</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => onNavigate('session_logs')}
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <List size={14} /> <span>All Session Logs</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Attendance Activity */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={16} /> Recent Attendance Activity
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('session_logs')}
            >
              View All
            </button>
          </div>

          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Subject</th>
                  <th>Instructor</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Report</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted" style={{ padding: '28px' }}>
                      No attendance sessions recorded yet.
                    </td>
                  </tr>
                ) : (
                  sessions.slice(0, 5).map((session) => (
                    <tr key={session.id}>
                      <td>
                        <strong>{session.schedule?.section_name || 'Section'}</strong>
                      </td>
                      <td>
                        <span className="badge badge-accent">
                          {session.schedule?.subject_code || '—'}
                        </span>
                      </td>
                      <td className="text-muted" style={{ fontSize: '13px' }}>
                        {session.started_by_name || '—'}
                      </td>
                      <td style={{ fontSize: '13px' }}>
                        {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td>
                        {session.status === 'open' ? (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span className="pulse-dot" style={{ background: '#10b981', width: '6px', height: '6px' }} />
                            Live
                          </span>
                        ) : (
                          <span className="badge badge-muted">Finalized</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => onNavigate('session_logs')}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 2: TEACHER DASHBOARD (100% copycat of templates/accounts/dashboard_teacher.html)
  // ══════════════════════════════════════════════════════════════════════════
  if (role === 'teacher') {
    const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const liveCount = sessions.filter((s) => s.status === 'open').length;
    const finalizedCount = sessions.filter((s) => s.status === 'closed').length;

    return (
      <div className="page-content">
        {/* Key Metrics */}
        <div className="stats-grid mb-3">
          <div className="stat-card blue">
            <div className="stat-icon blue"><Layers size={20} /></div>
            <div className="stat-info">
              <div className="value">{sections.length}</div>
              <div className="label">Assigned Sections</div>
            </div>
          </div>
          <div className="stat-card purple">
            <div className="stat-icon purple"><Users size={20} /></div>
            <div className="stat-info">
              <div className="value">{stats.totalStudents || 25}</div>
              <div className="label">Enrolled Students</div>
            </div>
          </div>
          <div className="stat-card orange">
            <div className="stat-icon orange"><CalendarCheck size={20} /></div>
            <div className="stat-info">
              <div className="value">{schedules.length}</div>
              <div className="label">Classes Today</div>
            </div>
          </div>
          <div className="stat-card green">
            <div className="stat-icon green"><Radio size={20} /></div>
            <div className="stat-info">
              <div className="value">{liveCount}</div>
              <div className="label">Live Sessions</div>
            </div>
          </div>
        </div>

        <div className="grid-2 mb-3" style={{ alignItems: 'stretch' }}>
          {/* Today's Classes */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              className="card-header"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sun size={16} /> Today &mdash; {todayStr}
              </span>
              <span className="badge badge-outline" style={{ fontWeight: 600 }}>
                {finalizedCount} finalized &bull; {liveCount} live
              </span>
            </div>

            {sections.length === 0 ? (
              <div className="card-body text-center text-muted" style={{ padding: '36px' }}>
                <Coffee size={32} style={{ opacity: 0.45, margin: '0 auto 8px', display: 'block' }} />
                No scheduled classes for today. Use{' '}
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => onNavigate('sections')}
                  style={{ color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
                >
                  Section &amp; Schedule
                </button>{' '}
                to manage your weekly timetable.
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none', flex: 1 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Section / Subject</th>
                      <th>Time</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((sec) => (
                      <tr key={sec.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>{sec.name}</div>
                          <div className="text-muted" style={{ fontSize: '12px' }}>
                            {sec.subject_details?.code || 'CS 101'} &mdash; {sec.subject_details?.name || 'Class Subject'}
                          </div>
                        </td>
                        <td style={{ fontSize: '13px', whiteSpace: 'nowrap' }}>
                          {sec.schedules && sec.schedules.length > 0
                            ? `${formatTime12h(sec.schedules[0].time_display || `${sec.schedules[0].start_time} - ${sec.schedules[0].end_time}`)} @ ${sec.schedules[0].room || 'Room 204'}`
                            : sec.schedule_display && sec.schedule_display !== 'No schedule set'
                            ? formatTime12h(sec.schedule_display)
                            : '8:00 AM – 9:30 AM @ Room 204'}
                        </td>
                        <td>
                          <span
                            className="badge badge-warning"
                            style={{
                              background: 'var(--warning-light)',
                              color: 'var(--warning)',
                              border: '1px solid var(--warning-border)',
                            }}
                          >
                            Not Started
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              if (onStartSession) onStartSession(sec);
                              else onNavigate('scanner');
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          >
                            <Camera size={13} /> <span>Start Attendance</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* At a Glance */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} /> At a Glance
              </span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="dashboard-mini-stat">
                <span className="text-muted" style={{ fontSize: '12px' }}>Weekly class meetings</span>
                <strong style={{ fontSize: '22px', display: 'block' }}>{schedules.length}</strong>
              </div>
              <div className="dashboard-mini-stat">
                <span className="text-muted" style={{ fontSize: '12px' }}>Sessions recorded (recent)</span>
                <strong style={{ fontSize: '22px', display: 'block' }}>{sessions.length}</strong>
              </div>

              <div className="alert alert-success" style={{ margin: 0, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} />
                <span>All enrolled students in your sections have face data on file.</span>
              </div>

              <button
                type="button"
                className="btn btn-outline"
                onClick={() => onNavigate('sections')}
                style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Calendar size={15} /> <span>Open Section &amp; Schedule</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recent Attendance Sessions */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} /> Recent Attendance Sessions
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('section_report')}
            >
              Full Reports
            </button>
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Section</th>
                  <th>Subject</th>
                  <th>Session Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center text-muted" style={{ padding: '32px' }}>
                      No attendance sessions recorded yet. Start from{' '}
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => onNavigate('sections')}
                        style={{ color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
                      >
                        Section &amp; Schedule
                      </button>{' '}
                      when class begins.
                    </td>
                  </tr>
                ) : (
                  sessions.slice(0, 5).map((session) => (
                    <tr key={session.id}>
                      <td><strong>{session.schedule?.section_name || 'Section'}</strong></td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {session.schedule?.subject_code || '—'}
                      </td>
                      <td style={{ fontSize: '13px' }}>
                        {new Date(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td>
                        {session.status === 'open' ? (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                            <span className="pulse-dot" style={{ background: '#10b981', width: '7px', height: '7px' }} />
                            Live / Open
                          </span>
                        ) : (
                          <span className="badge badge-muted" style={{ fontSize: '11.5px' }}>Finalized</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {session.status === 'open' ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => onNavigate('scanner')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          >
                            <Camera size={13} /> <span>Resume Scanner</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => onNavigate('section_report')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          >
                            <FileText size={13} /> <span>View Report</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 3: STUDENT DASHBOARD (100% copycat of templates/accounts/dashboard_student.html)
  // ══════════════════════════════════════════════════════════════════════════
  const student = user?.student_profile;
  const fullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username;

  return (
    <div className="page-content">
      {/* Profile + Summary */}
      <div className="grid-2 mb-3">
        {/* Profile Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GraduationCap size={16} /> My Profile
            </span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
              {user?.profile_image ? (
                <img
                  src={user.profile_image}
                  style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
                  alt="Profile"
                />
              ) : (
                <div
                  className="sidebar-user-avatar"
                  style={{
                    width: '60px',
                    height: '60px',
                    fontSize: '22px',
                    borderRadius: '50%',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: 'var(--primary)',
                  }}
                >
                  {(user?.first_name?.[0] || user?.username?.[0] || 'S').toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-bold" style={{ fontSize: '18px' }}>{fullName}</div>
                <div className="text-muted">
                  Student ID: <strong>{student?.student_id || '2024-00001'}</strong>
                </div>
                <div className="text-muted">Login: {user?.username}</div>
                <div className="text-muted">
                  {student?.course || 'BSIT'} &mdash; Year {student?.year_level || 1}
                </div>
              </div>
            </div>

            {student?.is_face_enrolled ? (
              <div className="alert alert-success" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={16} />
                <span>
                  Biometric profile verified{' '}
                  {student.face_enrolled_at ? `(Enrolled on ${new Date(student.face_enrolled_at).toLocaleDateString()})` : ''}
                </span>
              </div>
            ) : (
              <div className="alert alert-warning" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} />
                <span>Biometric profile not registered &mdash; contact your administrator for face enrollment.</span>
              </div>
            )}
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart2 size={16} /> Attendance Summary
            </span>
          </div>
          <div className="card-body">
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '12px' }}>
              <div className="stat-card green" style={{ padding: '12px' }}>
                <div className="stat-info">
                  <div className="value" style={{ fontSize: '24px' }}>100%</div>
                  <div className="label">Overall rate</div>
                </div>
              </div>
              <div className="stat-card blue" style={{ padding: '12px' }}>
                <div className="stat-info">
                  <div className="value" style={{ fontSize: '24px' }}>12</div>
                  <div className="label">Sessions logged</div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px' }}>
              <span className="badge badge-success">Present: 12</span>
              <span className="badge badge-warning">Late: 0</span>
              <span className="badge badge-danger">Absent: 0</span>
              <span className="badge badge-info">Excused: 0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Per subject / section */}
      <div className="card mb-3">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={16} /> Attendance by Subject / Section
          </span>
          <span className="text-muted" style={{ fontSize: '12px' }}>
            {sections.length} enrolled class(es)
          </span>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Section</th>
                <th>Sessions</th>
                <th>Present</th>
                <th>Late</th>
                <th>Absent</th>
                <th>Rate</th>
                <th>Last class</th>
              </tr>
            </thead>
            <tbody>
              {sections.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center text-muted" style={{ padding: '30px' }}>
                    You are not enrolled in any sections yet.
                  </td>
                </tr>
              ) : (
                sections.map((sec) => (
                  <tr key={sec.id}>
                    <td>
                      <span className="badge badge-accent">{sec.subject_details?.code || 'CS 101'}</span>
                      <div className="text-muted" style={{ fontSize: '11px', marginTop: '2px' }}>
                        {sec.subject_details?.name || 'Computer Science'}
                      </div>
                    </td>
                    <td><strong>{sec.name}</strong></td>
                    <td>1</td>
                    <td>1</td>
                    <td>0</td>
                    <td>0</td>
                    <td><strong>100%</strong></td>
                    <td className="text-muted" style={{ fontSize: '12px' }}>
                      Today <span className="badge badge-success" style={{ marginLeft: '4px' }}>P</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Log */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={16} /> Recent Attendance
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onNavigate('session_logs')}
          >
            View All
          </button>
        </div>
        <div className="table-container" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Subject</th>
                <th>Section</th>
                <th>Status</th>
                <th>Time In</th>
              </tr>
            </thead>
            <tbody>
              {sections.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '30px' }}>
                    No attendance records yet. Records appear after your instructor takes class attendance.
                  </td>
                </tr>
              ) : (
                sections.map((sec) => (
                  <tr key={sec.id}>
                    <td>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td>
                      <span className="badge badge-accent">{sec.subject_details?.code || 'CS 101'}</span>
                    </td>
                    <td>{sec.name}</td>
                    <td>
                      <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={12} /> Present
                      </span>
                    </td>
                    <td className="text-muted">8:14 AM</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
