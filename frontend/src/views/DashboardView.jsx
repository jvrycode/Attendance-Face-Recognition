import React, { useState, useEffect } from 'react';
import {
  Radio,
  CalendarCheck,
  Lock,
  ScanFace,
  Plus,
  Building,
  Camera,
  Users,
  Award,
  ArrowRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Api } from '../api';

export default function DashboardView({ user, onNavigate }) {
  const [stats, setStats] = useState({
    liveSessions: 0,
    sessionsToday: 0,
    finalizedToday: 0,
    enrolledPct: 100,
    enrolledCount: 0,
    totalStudents: 0,
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
            liveSessions: statRes.open_sessions_count || 0,
            sessionsToday: statRes.sessions_today_count || 0,
            finalizedToday: statRes.sessions_today_closed || 0,
            enrolledPct: statRes.face_enrollment_pct !== undefined ? statRes.face_enrollment_pct : 100,
            enrolledCount: statRes.face_enrolled_count || 0,
            totalStudents: statRes.total_students || 0,
            totalTeachers: statRes.total_teachers || 0,
            totalSubjects: statRes.total_subjects || 0,
            totalSections: statRes.total_sections || 0,
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
      {/* Top Banner / Welcome */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            Welcome back, {user?.first_name || user?.username}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
            {role === 'admin'
              ? 'Administrator Overview & System Health'
              : role === 'teacher'
              ? 'Faculty Portal & Active Sections'
              : 'Student Attendance Records'}
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

      {/* KPI Stats Grid */}
      <div className="grid-4" style={{ marginBottom: '28px' }}>
        <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div className="stat-icon" style={{ background: 'var(--success-light)', color: 'var(--success)', width: '44px', height: '44px', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <Radio size={22} className="pulse-indicator" />
          </div>
          <div className="stat-info">
            <div className="value" style={{ fontSize: '28px', fontWeight: '800', lineHeight: 1 }}>{stats.liveSessions}</div>
            <div className="label" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', fontWeight: '500' }}>Live Sessions Now</div>
          </div>
        </div>

        <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div className="stat-icon" style={{ background: 'var(--info-light)', color: 'var(--info)', width: '44px', height: '44px', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <CalendarCheck size={22} />
          </div>
          <div className="stat-info">
            <div className="value" style={{ fontSize: '28px', fontWeight: '800', lineHeight: 1 }}>{stats.sessionsToday}</div>
            <div className="label" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', fontWeight: '500' }}>Sessions Today</div>
          </div>
        </div>

        <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div className="stat-icon" style={{ background: 'var(--accent-light)', color: 'var(--accent)', width: '44px', height: '44px', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <Lock size={22} />
          </div>
          <div className="stat-info">
            <div className="value" style={{ fontSize: '28px', fontWeight: '800', lineHeight: 1 }}>{stats.finalizedToday}</div>
            <div className="label" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', fontWeight: '500' }}>Finalized Today</div>
          </div>
        </div>

        <div className="stat-card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)', background: 'var(--bg-card)', padding: '20px', borderRadius: 'var(--radius-lg)' }}>
          <div className="stat-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)', width: '44px', height: '44px', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
            <ScanFace size={22} />
          </div>
          <div className="stat-info">
            <div className="value" style={{ fontSize: '28px', fontWeight: '800', lineHeight: 1 }}>{stats.enrolledPct}%</div>
            <div className="label" style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', fontWeight: '500' }}>Face Enrolled</div>
          </div>
        </div>
      </div>

      {/* Quick Shortcuts */}
      <div style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', color: 'var(--text-primary)' }}>Quick Actions</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <button
            type="button"
            className="card"
            onClick={() => onNavigate('sections')}
            style={{
              padding: '16px',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Building size={20} color="var(--info)" />
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Class Sections</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Manage student sections</div>
              </div>
            </div>
            <ArrowRight size={16} color="var(--text-muted)" />
          </button>

          <button
            type="button"
            className="card"
            onClick={() => onNavigate('users')}
            style={{
              padding: '16px',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Users size={20} color="var(--success)" />
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>User Management</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Staff, faculty & students</div>
              </div>
            </div>
            <ArrowRight size={16} color="var(--text-muted)" />
          </button>

          <button
            type="button"
            className="card"
            onClick={() => onNavigate('programs')}
            style={{
              padding: '16px',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Award size={20} color="var(--warning)" />
              <div>
                <div style={{ fontWeight: '600', fontSize: '14px' }}>Colleges & Programs</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Academic departments</div>
              </div>
            </div>
            <ArrowRight size={16} color="var(--text-muted)" />
          </button>
        </div>
      </div>

      {/* Sections Table Card */}
      <div className="card" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 2px 0' }}>Academic Class Sections</h3>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)' }}>Overview of all registered class sections in TiDB</p>
          </div>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => onNavigate('sections')}>
            View All Sections
          </button>
        </div>

        {sections.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Building size={36} style={{ margin: '0 auto 10px auto', opacity: 0.4 }} />
            <p style={{ margin: 0, fontWeight: '500' }}>No class sections created yet.</p>
            <p style={{ fontSize: '12px', margin: '4px 0 0 0' }}>Go to Class Sections to add your first course schedule.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Section Name</th>
                  <th>School Year</th>
                  <th>Semester</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((sec) => (
                  <tr key={sec.id}>
                    <td style={{ fontWeight: '600' }}>{sec.name}</td>
                    <td>{sec.school_year}</td>
                    <td>
                      <span className="badge badge-info">{sec.semester}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => onNavigate('scanner')}
                      >
                        Start Session
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
