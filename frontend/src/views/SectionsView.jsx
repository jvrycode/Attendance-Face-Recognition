import React, { useState, useEffect } from 'react';
import {
  List,
  Calendar,
  Plus,
  Camera,
  X,
  Check,
  Building,
  Clock,
  User,
  ExternalLink,
} from 'lucide-react';
import { Api } from '../api';

export default function SectionsView({ user, onNavigate, onStartSession }) {
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'
  const [sections, setSections] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    program: '',
    school_year: '2026-2027',
    semester: '1st',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [secList, schList, progList] = await Promise.all([
        Api.getSections(),
        Api.getSchedules(),
        Api.getPrograms(),
      ]);
      setSections(secList);
      setSchedules(schList);
      setPrograms(progList);
    } catch (err) {
      console.error('Error loading sections data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSection = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      setErrorMsg('Section name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      await Api.createSection(formData);
      setSuccessMsg(`Section ${formData.name} created successfully!`);
      setShowAddModal(false);
      setFormData({ name: '', program: '', school_year: '2026-2027', semester: '1st' });
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create section.');
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="page-content" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            {user?.role === 'student' ? 'My Schedule' : 'Sections & Schedules'}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
            {user?.role === 'student'
              ? 'Your enrolled course subjects, room assignments, and weekly class timetable'
              : user?.role === 'teacher'
              ? 'Your assigned teaching sections, course subjects, and class schedules'
              : 'Manage school sections, subjects, and weekly timetable schedules'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* View Toggle */}
          <div className="view-toggle-group" style={{ display: 'inline-flex', background: 'var(--bg-secondary)', padding: '3px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setViewMode('table')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
            >
              <List size={14} />
              <span>Table View</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setViewMode('grid')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px' }}
            >
              <Calendar size={14} />
              <span>Timetable Grid</span>
            </button>
          </div>

          {isAdmin && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>Add Section</span>
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* VIEW 1: TABLE VIEW */}
      {viewMode === 'table' ? (
        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none', margin: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Program</th>
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Section</th>
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subject Offering</th>
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Teacher</th>
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>School Year</th>
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Students</th>
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading sections...
                    </td>
                  </tr>
                ) : sections.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No class sections available.
                    </td>
                  </tr>
                ) : (
                  sections.map((sec) => (
                    <tr key={sec.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <span className="badge badge-info" style={{ fontSize: '11px', fontWeight: '700' }}>
                          {sec.program?.code || 'CITEC'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {sec.name}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {sec.subject_details ? (
                          <div>
                            <span className="badge badge-accent" style={{ fontSize: '11px', fontWeight: '700', marginRight: '6px' }}>
                              {sec.subject_details.code}
                            </span>
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{sec.subject_details.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '13px' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                        {sec.teacher_details?.user
                          ? `${sec.teacher_details.user.first_name} ${sec.teacher_details.user.last_name}`
                          : '—'}
                      </td>
                      <td style={{ padding: '14px 18px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        {sec.school_year} ({sec.semester})
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span className="badge badge-secondary" style={{ fontSize: '11px', fontWeight: '600' }}>
                          {sec.student_count || 0} enrolled
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            if (onStartSession) onStartSession(sec);
                            else onNavigate('scanner');
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        >
                          <Camera size={13} />
                          <span>Scan</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VIEW 2: TIMETABLE GRID */
        <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: 'var(--primary)' }} />
            <span>Weekly Class Timetable</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
            {daysOfWeek.map((day) => {
              const daySchedules = schedules.filter((s) => s.day_display === day);
              return (
                <div key={day} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  <div style={{ padding: '10px', background: 'var(--primary)', color: '#ffffff', fontWeight: '700', fontSize: '13px', textAlign: 'center' }}>
                    {day}
                  </div>
                  <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '180px' }}>
                    {daySchedules.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '24px 0' }}>
                        No classes
                      </div>
                    ) : (
                      daySchedules.map((sch) => (
                        <div
                          key={sch.id}
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            boxShadow: 'var(--shadow-xs)',
                          }}
                        >
                          <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--primary)' }}>
                            {sch.section_name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} />
                            <span>
                              {sch.start_time} - {sch.end_time}
                            </span>
                          </div>
                          {sch.room && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              Room: {sch.room}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Section Modal */}
      {showAddModal && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-card modal-md" style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="modal-header" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="modal-title" style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building size={18} style={{ color: 'var(--primary)' }} />
                <span>Add Class Section</span>
              </h3>
              <button
                type="button"
                className="btn btn-outline btn-sm modal-close-btn"
                onClick={() => setShowAddModal(false)}
                style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSection}>
              <div className="modal-body" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {errorMsg && (
                  <div className="alert alert-danger" style={{ fontSize: '13px', padding: '10px 14px' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                    Section Name *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. BSCS-2A, IT 43, CS 301"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                    Academic Program
                  </label>
                  <select
                    className="form-select"
                    value={formData.program}
                    onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                  >
                    <option value="">Select program...</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      School Year
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.school_year}
                      onChange={(e) => setFormData({ ...formData, school_year: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      Semester
                    </label>
                    <select
                      className="form-select"
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                    >
                      <option value="1st">1st Semester</option>
                      <option value="2nd">2nd Semester</option>
                      <option value="Summer">Summer Term</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 22px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <Check size={16} />
                  <span>{submitting ? 'Creating...' : 'Create Section'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
