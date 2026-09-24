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
  ArrowRight,
} from 'lucide-react';
import { Api } from '../api';

export default function DashboardView({ user, onNavigate, onStartSession }) {
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [secs, statRes] = await Promise.all([
          Api.getSections(),
          Api.getDashboardStats().catch(() => null),
        ]);
        setSections(secs || []);

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

  const role = user?.role || 'admin';

  return (
    <div className="page-content" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Banner */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            {role === 'admin' ? 'Admin Dashboard' : role === 'teacher' ? 'Teacher Dashboard' : 'Student Dashboard'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
            System overview &mdash; Welcome back, {user?.first_name || user?.username}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigate('scanner')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Camera size={16} />
            <span>Launch Live Scanner</span>
          </button>
        </div>
      </div>

      {/* Primary KPIs (Exact reference from dashboard_admin.html) */}
      <div className="stats-grid mb-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
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

      {/* Today's Operations (Exact reference from dashboard_admin.html) */}
      <div className="stats-grid mb-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius)' }}>
          <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
            <Radio size={20} />
          </div>
          <div className="stat-info">
            <div className="value" style={{ fontSize: '24px', fontWeight: '800' }}>{stats.liveSessions}</div>
            <div className="label" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Live Sessions Now</div>
          </div>
        </div>

        <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius)' }}>
          <div className="stat-icon" style={{ background: 'var(--info-light)', color: 'var(--info)', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
            <CalendarCheck size={20} />
          </div>
          <div className="stat-info">
            <div className="value" style={{ fontSize: '24px', fontWeight: '800' }}>{stats.sessionsToday}</div>
            <div className="label" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Sessions Today</div>
          </div>
        </div>

        <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius)' }}>
          <div className="stat-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
            <Lock size={20} />
          </div>
          <div className="stat-info">
            <div className="value" style={{ fontSize: '24px', fontWeight: '800' }}>{stats.finalizedToday}</div>
            <div className="label" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Finalized Today</div>
          </div>
        </div>

        <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius)' }}>
          <div className="stat-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)', width: '40px', height: '40px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
            <ScanFace size={20} />
          </div>
          <div className="stat-info">
            <div className="value" style={{ fontSize: '24px', fontWeight: '800' }}>{stats.enrolledPct}%</div>
            <div className="label" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Face Enrolled ({stats.enrolledCount}/{stats.totalStudents})
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Quick Actions + Academic Snapshot */}
      <div className="grid-2 mb-3" style={{ alignItems: 'stretch', gap: '20px', marginBottom: '28px' }}>
        {/* Quick Actions (Exact reference from dashboard_admin.html) */}
        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <span className="card-title" style={{ fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={16} style={{ color: 'var(--warning)' }} /> Quick Actions
            </span>
          </div>
          <div className="card-body dashboard-action-grid" style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            <button type="button" className="btn btn-primary" onClick={() => onNavigate('users')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
              <UserPlus size={15} /> <span>Register Student</span>
            </button>
            <button type="button" className="btn btn-outline" onClick={() => onNavigate('users')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
              <Shield size={15} /> <span>Add Faculty / Staff</span>
            </button>
            <button type="button" className="btn btn-outline" onClick={() => onNavigate('sections')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
              <Building size={15} /> <span>Add Section</span>
            </button>
            <button type="button" className="btn btn-outline" onClick={() => onNavigate('schedules')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
              <Calendar size={15} /> <span>Add Schedule</span>
            </button>
            <button type="button" className="btn btn-outline" onClick={() => onNavigate('users')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
              <Users size={15} /> <span>User Management</span>
            </button>
            <button type="button" className="btn btn-outline" onClick={() => onNavigate('face_enrollment')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
              <Camera size={15} /> <span>Face Enrollment</span>
            </button>
          </div>
        </div>

        {/* Academic Snapshot */}
        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <span className="card-title" style={{ fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieChart size={16} style={{ color: 'var(--info)' }} /> Academic Snapshot
            </span>
          </div>
          <div className="card-body" style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Student face enrollment</span>
                <strong>{stats.enrolledPct}%</strong>
              </div>
              <div className="dashboard-progress-track" style={{ width: '100%', height: '8px', background: 'var(--bg-secondary)', borderRadius: '9999px', overflow: 'hidden' }}>
                <div className="dashboard-progress-bar" style={{ width: `${stats.enrolledPct}%`, height: '100%', background: 'var(--success)' }}></div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.totalSections}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sections</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.totalSubjects}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Subjects</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>{stats.totalTeachers}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Faculty</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Class Sections List */}
      <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title" style={{ fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building size={16} /> Active Class Sections
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onNavigate('sections')}
            style={{ fontSize: '12px' }}
          >
            View All Sections
          </button>
        </div>

        <div className="table-container" style={{ border: 'none', margin: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Section</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subject Offering</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Teacher</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Students</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sections.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No class sections logged.
                  </td>
                </tr>
              ) : (
                sections.slice(0, 5).map((sec) => (
                  <tr key={sec.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 18px', fontWeight: '700' }}>{sec.name}</td>
                    <td style={{ padding: '12px 18px' }}>
                      <span className="badge badge-accent" style={{ fontWeight: '700' }}>
                        {sec.subject_details?.code || 'CS 101'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 18px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {sec.teacher_details?.user ? `${sec.teacher_details.user.first_name} ${sec.teacher_details.user.last_name}` : '—'}
                    </td>
                    <td style={{ padding: '12px 18px' }}>
                      <span className="badge badge-secondary">{sec.student_count || 0} enrolled</span>
                    </td>
                    <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          if (onStartSession) onStartSession(sec);
                          else onNavigate('scanner');
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Camera size={13} />
                        <span>Live</span>
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
