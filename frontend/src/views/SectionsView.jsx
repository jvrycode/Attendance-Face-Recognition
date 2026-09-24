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
} from 'lucide-react';
import { Api } from '../api';

export default function SectionsView({ user, onNavigate, onStartSession, onSetHeaderInfo }) {
  const [viewMode, setViewMode] = useState('table');
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

  const isAdmin = user?.role === 'admin';
  const role = user?.role || 'admin';

  // Update Top-Header in App.jsx
  useEffect(() => {
    if (onSetHeaderInfo) {
      onSetHeaderInfo({
        title: role === 'student' ? 'My Schedule' : role === 'teacher' ? 'Sections & Schedules' : 'Class Sections',
        subtitle: role === 'student'
          ? 'Your enrolled course subjects, room assignments, and weekly class timetable'
          : role === 'teacher'
          ? 'Your assigned teaching sections, course subjects, and class schedules'
          : 'Manage school sections, subjects, and weekly timetable schedules',
        headerActions: (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div className="view-toggle-group">
              <button
                type="button"
                className={`btn ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setViewMode('table')}
              >
                <List size={14} /> <span>Table View</span>
              </button>
              <button
                type="button"
                className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setViewMode('grid')}
              >
                <Calendar size={14} /> <span>Timetable Grid</span>
              </button>
            </div>

            {isAdmin && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={16} /> <span>Add Section</span>
              </button>
            )}
          </div>
        ),
      });
    }
  }, [viewMode, isAdmin, role]);

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

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="page-content">
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* VIEW 1: TABLE VIEW */}
      {viewMode === 'table' ? (
        <div className="card mb-3">
          <div className="table-container" style={{ border: 'none', margin: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Section &amp; Year</th>
                  <th>Subject Offering</th>
                  <th>Schedule (Day &amp; Time)</th>
                  {role !== 'teacher' && <th>Assigned Teacher</th>}
                  <th>School Year</th>
                  <th>Students</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center text-muted" style={{ padding: '32px' }}>
                      Loading sections...
                    </td>
                  </tr>
                ) : sections.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center text-muted" style={{ padding: '36px' }}>
                      No class sections available.
                    </td>
                  </tr>
                ) : (
                  sections.map((sec) => (
                    <tr key={sec.id}>
                      <td>
                        <span className="badge badge-info" style={{ fontWeight: '700' }}>
                          {sec.program?.code || 'CITEC'}
                        </span>
                      </td>
                      <td>
                        <strong>{sec.name}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>1st Year</div>
                      </td>
                      <td>
                        {sec.subject_details ? (
                          <div>
                            <span className="badge badge-accent" style={{ fontWeight: '700', marginRight: '6px' }}>
                              {sec.subject_details.code}
                            </span>
                            <span>{sec.subject_details.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td style={{ fontSize: '13px' }}>
                        Mon/Wed 8:00 AM – 9:30 AM
                      </td>
                      {role !== 'teacher' && (
                        <td className="text-muted" style={{ fontSize: '13px' }}>
                          {sec.teacher_details?.user
                            ? `${sec.teacher_details.user.first_name} ${sec.teacher_details.user.last_name}`
                            : '—'}
                        </td>
                      )}
                      <td style={{ fontSize: '13px' }}>
                        {sec.school_year} ({sec.semester})
                      </td>
                      <td>
                        <span className="badge badge-secondary">{sec.student_count || 0} enrolled</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            if (onStartSession) onStartSession(sec);
                            else onNavigate('scanner');
                          }}
                        >
                          <Camera size={13} /> <span>Scan</span>
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
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: 'var(--primary)' }} />
            <span>Weekly Class Timetable</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
            {daysOfWeek.map((day) => {
              const daySchedules = schedules.filter((s) => s.day_display === day);
              return (
                <div key={day} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  <div style={{ padding: '8px', background: 'var(--primary)', color: '#ffffff', fontWeight: '700', fontSize: '12px', textAlign: 'center' }}>
                    {day}
                  </div>
                  <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '160px' }}>
                    {daySchedules.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', padding: '20px 0' }}>
                        No classes
                      </div>
                    ) : (
                      daySchedules.map((sch) => (
                        <div
                          key={sch.id}
                          style={{
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            padding: '6px 8px',
                          }}
                        >
                          <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--primary)' }}>
                            {sch.section_name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={10} />
                            <span>{sch.start_time} - {sch.end_time}</span>
                          </div>
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
          <div className="modal-card modal-md">
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  <label className="form-label">Section Name *</label>
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
                  <label className="form-label">Academic Program</label>
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
                    <label className="form-label">School Year</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.school_year}
                      onChange={(e) => setFormData({ ...formData, school_year: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Semester</label>
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
