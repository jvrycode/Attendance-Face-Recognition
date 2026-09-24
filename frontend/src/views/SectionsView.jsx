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
  Users,
  Eye,
  Trash2,
  ExternalLink,
  GraduationCap,
  Layers,
  MapPin,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { Api } from '../api';
import { formatTime12h } from '../utils/time';

export default function SectionsView({ user, onNavigate, onStartSession, onSetHeaderInfo }) {
  const [viewMode, setViewMode] = useState('table');
  const [sections, setSections] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedSectionDetail, setSelectedSectionDetail] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    program: '',
    year_level: 1,
    school_year: '2025-2026',
    semester: '1st',
    teacher: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [secList, schList, progList, teacherList] = await Promise.all([
        Api.getSections(),
        Api.getSchedules(),
        Api.getPrograms(),
        Api.getTeachers(),
      ]);
      setSections(secList);
      setSchedules(schList);
      setPrograms(progList);
      setTeachers(teacherList);
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
        subtitle:
          role === 'student'
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
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> <span>Add Section</span>
              </button>
            )}
          </div>
        ),
      });
    }
  }, [viewMode, isAdmin, role, onSetHeaderInfo]);

  const handleCreateSection = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      setErrorMsg('Section name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const payload = {
        name: formData.name,
        program: formData.program || null,
        year_level: parseInt(formData.year_level, 10) || 1,
        school_year: formData.school_year,
        semester: formData.semester,
        teacher: formData.teacher || null,
      };
      await Api.createSection(payload);
      setSuccessMsg(`Section "${formData.name}" created successfully!`);
      setShowAddModal(false);
      setFormData({
        name: '',
        program: '',
        year_level: 1,
        school_year: '2025-2026',
        semester: '1st',
        teacher: '',
      });
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create section.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSection = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete class section "${name}"?`)) return;
    try {
      await Api.deleteSection(id);
      setSuccessMsg(`Section "${name}" deleted.`);
      loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete section.');
    }
  };

  // Helper to format schedules summary
  const getSectionScheduleDisplay = (sec) => {
    const secSchedules = schedules.filter((s) => s.section === sec.id);
    if (secSchedules.length === 0) {
      if (sec.schedule_display && sec.schedule_display !== 'No schedule set') {
        return formatTime12h(sec.schedule_display);
      }
      return 'No schedule set';
    }
    return secSchedules
      .map((s) => {
        const time = formatTime12h(
          s.time_display || (s.start_time && s.end_time ? `${s.start_time} - ${s.end_time}` : '')
        );
        return `${s.days_display || s.day_display} ${time} @ ${s.room || 'TBA'}`;
      })
      .join(', ');
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

      {errorMsg && (
        <div className="alert alert-danger" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* VIEW 1: TABLE VIEW */}
      {viewMode === 'table' ? (
        <div className="card mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none', margin: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Program</th>
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Section &amp; Year</th>
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subject Offering</th>
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Schedule (Day &amp; Time)</th>
                  {role !== 'teacher' && <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Assigned Teacher</th>}
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>School Year</th>
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Students</th>
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={role !== 'teacher' ? 8 : 7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Loading sections...
                    </td>
                  </tr>
                ) : sections.length === 0 ? (
                  <tr>
                    <td colSpan={role !== 'teacher' ? 8 : 7} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No class sections available.{' '}
                      {isAdmin && (
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => setShowAddModal(true)}
                          style={{ color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
                        >
                          Add one
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  sections.map((sec) => {
                    const schedText = getSectionScheduleDisplay(sec);
                    const subjectCode = sec.effective_subject_code || sec.subject_details?.code || (sec.subject ? 'Linked' : '');
                    const subjectName = sec.effective_subject_name || sec.subject_details?.name || '';
                    return (
                      <tr key={sec.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 18px' }}>
                          <span className="badge badge-info" style={{ fontWeight: '700' }}>
                            {sec.program_details?.code || sec.program?.code || 'CITEC'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <strong>{sec.name}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {sec.year_level_display || `${sec.year_level || 1}st Year`}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          {subjectCode && subjectCode !== '—' ? (
                            <div>
                              <span className="badge badge-accent" style={{ fontWeight: '700', marginRight: '6px' }}>
                                {subjectCode}
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: '500' }}>{subjectName}</span>
                            </div>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '12px' }}>No subject linked</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 18px', fontSize: '13px' }}>
                          {schedText !== 'No schedule set' ? (
                            <span
                              className="badge badge-outline"
                              style={{
                                fontSize: '12px',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                color: 'var(--text-primary)',
                                borderColor: 'rgba(99,102,241,0.35)',
                                background: 'rgba(99,102,241,0.06)',
                              }}
                            >
                              <Clock size={13} style={{ color: 'var(--primary)' }} />
                              {schedText}
                            </span>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '12px' }}>
                              <Clock size={12} /> No schedule set
                            </span>
                          )}
                        </td>
                        {role !== 'teacher' && (
                          <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            {sec.teacher_details?.user
                              ? `${sec.teacher_details.user.first_name} ${sec.teacher_details.user.last_name}`
                              : '— Unassigned'}
                          </td>
                        )}
                        <td style={{ padding: '14px 18px', fontSize: '13px' }}>
                          {sec.school_year} <span className="text-muted">({sec.semester})</span>
                        </td>
                        <td style={{ padding: '14px 18px' }}>
                          <button
                            type="button"
                            className="badge badge-info"
                            style={{ cursor: 'pointer', border: 'none', background: 'none' }}
                            onClick={() => setSelectedSectionDetail(sec)}
                            title="View Section Details & Class Roster"
                          >
                            <Users size={12} style={{ marginRight: '4px' }} />
                            {sec.student_count || 0} enrolled
                          </button>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                if (onStartSession) onStartSession(sec);
                                else onNavigate('scanner');
                              }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Camera size={13} /> <span>Scan</span>
                            </button>

                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setSelectedSectionDetail(sec)}
                              title="View Details"
                              style={{ padding: '4px 8px' }}
                            >
                              <Eye size={13} />
                            </button>

                            {isAdmin && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm text-danger"
                                onClick={() => handleDeleteSection(sec.id, sec.name)}
                                title="Delete Section"
                                style={{ padding: '4px 8px' }}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VIEW 2: TIMETABLE GRID */
        <div className="card mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="card-title" style={{ fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} style={{ color: 'var(--primary)' }} />
              Weekly Class Schedule Graph
            </span>
            <span className="badge badge-info" style={{ fontWeight: '600' }}>
              {schedules.length} Scheduled Meeting{schedules.length !== 1 ? 's' : ''} / Week
            </span>
          </div>

          <div style={{ padding: '18px', overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', minWidth: '700px' }}>
              {daysOfWeek.map((dayName) => {
                const dayShort = dayName.slice(0, 3);
                const daySchedules = schedules.filter(
                  (s) =>
                    (s.day_of_week && s.day_of_week.toLowerCase() === dayShort.toLowerCase()) ||
                    (s.day_2 && s.day_2.toLowerCase() === dayShort.toLowerCase())
                );
                return (
                  <div
                    key={dayName}
                    style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ fontWeight: '700', fontSize: '13px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', color: 'var(--text-primary)' }}>
                      {dayName}
                    </div>
                    {daySchedules.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>
                        No classes
                      </div>
                    ) : (
                      daySchedules.map((sch) => {
                        const time = formatTime12h(
                          sch.time_display || (sch.start_time && sch.end_time ? `${sch.start_time} - ${sch.end_time}` : '')
                        );
                        return (
                          <div
                            key={sch.id}
                            style={{
                              padding: '8px 10px',
                              background: 'var(--accent-light)',
                              borderLeft: '3px solid var(--accent)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '12px',
                            }}
                          >
                            <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{sch.section_name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                              <Clock size={11} style={{ display: 'inline', marginRight: '3px' }} />
                              {time}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '1px' }}>
                              Room: {sch.room || 'TBA'}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD CLASS SECTION MODAL (Exact Copycat of section_form.html) ─── */}
      {showAddModal && (
        <div
          className="modal-backdrop open"
          style={{ display: 'flex', opacity: 1, zIndex: 1200 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="modal-card modal-md" style={{ width: '100%', maxWidth: '560px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="modal-header" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 className="modal-title" style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building size={18} style={{ color: 'var(--primary)' }} />
                  <span>Add Class Section</span>
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Define program, section code, academic year, and teacher
                </div>
              </div>
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
                    Academic Program *
                  </label>
                  <select
                    className="form-select"
                    value={formData.program}
                    onChange={(e) => setFormData({ ...formData, program: e.target.value })}
                    required
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
                      Section Name / Code *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. IT-43, BSCS-2A"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      Year Level *
                    </label>
                    <select
                      className="form-select"
                      value={formData.year_level}
                      onChange={(e) => setFormData({ ...formData, year_level: e.target.value })}
                      required
                    >
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      School Year *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.school_year}
                      onChange={(e) => setFormData({ ...formData, school_year: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      Semester / Term *
                    </label>
                    <select
                      className="form-select"
                      value={formData.semester}
                      onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                      required
                    >
                      <option value="1st">1st Semester</option>
                      <option value="2nd">2nd Semester</option>
                      <option value="summer">Summer Term</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                    Assigned Teacher (Optional)
                  </label>
                  <select
                    className="form-select"
                    value={formData.teacher}
                    onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
                  >
                    <option value="">Select instructor...</option>
                    {teachers.map((t) => (
                      <option key={t.id || t.username} value={t.teacher_profile?.id || t.id}>
                        {t.first_name ? `${t.first_name} ${t.last_name || ''}` : t.username}
                      </option>
                    ))}
                  </select>
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

      {/* ─── SECTION DETAIL / ROSTER MODAL (Exact Copycat of section-detail-modal) ─── */}
      {selectedSectionDetail && (
        <div
          className="modal-backdrop open"
          style={{ display: 'flex', opacity: 1, zIndex: 1200 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSectionDetail(null);
          }}
        >
          <div className="modal-card modal-lg" style={{ width: '100%', maxWidth: '640px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="modal-header" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 className="modal-title" style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={18} style={{ color: 'var(--primary)' }} />
                  <span>{selectedSectionDetail.name}</span>
                </h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedSectionDetail.program_details?.code || selectedSectionDetail.program?.code || 'CITEC'} •{' '}
                  {selectedSectionDetail.year_level_display || `${selectedSectionDetail.year_level || 1}st Year`} •{' '}
                  {selectedSectionDetail.school_year} ({selectedSectionDetail.semester})
                </div>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm modal-close-btn"
                onClick={() => setSelectedSectionDetail(null)}
                style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* KPI Cards */}
              <div className="stats-grid mb-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div className="stat-card" style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Subject Offering</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', marginTop: '2px', color: 'var(--text-primary)' }}>
                    {selectedSectionDetail.effective_subject_code || selectedSectionDetail.subject_details?.code || '—'}
                  </div>
                </div>
                <div className="stat-card" style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Assigned Teacher</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', marginTop: '2px', color: 'var(--text-primary)' }}>
                    {selectedSectionDetail.teacher_details?.user
                      ? `${selectedSectionDetail.teacher_details.user.first_name} ${selectedSectionDetail.teacher_details.user.last_name}`
                      : 'Unassigned'}
                  </div>
                </div>
                <div className="stat-card blue" style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Enrolled Students</div>
                  <div style={{ fontSize: '18px', fontWeight: '800', marginTop: '2px', color: 'var(--info)' }}>
                    {selectedSectionDetail.student_count || 0}
                  </div>
                </div>
              </div>

              {/* Schedules List with 12h Time */}
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} style={{ color: 'var(--primary)' }} /> Class Meeting Schedules
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {schedules.filter((s) => s.section === selectedSectionDetail.id).length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '8px' }}>
                      No meeting schedules assigned yet.
                    </div>
                  ) : (
                    schedules
                      .filter((s) => s.section === selectedSectionDetail.id)
                      .map((sch) => {
                        const time = formatTime12h(
                          sch.time_display || (sch.start_time && sch.end_time ? `${sch.start_time} - ${sch.end_time}` : '')
                        );
                        return (
                          <div
                            key={sch.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '8px 12px',
                              background: 'var(--bg-secondary)',
                              borderRadius: 'var(--radius)',
                              fontSize: '12.5px',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <span style={{ fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <Calendar size={13} style={{ color: 'var(--primary)' }} />
                              {sch.days_display || sch.day_display}
                            </span>
                            <span className="badge badge-outline" style={{ fontWeight: '600' }}>
                              <Clock size={12} style={{ marginRight: '4px' }} />
                              {time}
                            </span>
                            <span className="text-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <MapPin size={12} />
                              {sch.room || 'TBA'}
                            </span>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ padding: '14px 22px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const sec = selectedSectionDetail;
                  setSelectedSectionDetail(null);
                  if (onStartSession) onStartSession(sec);
                  else onNavigate('scanner');
                }}
              >
                <Camera size={14} /> <span>Open Attendance Scanner</span>
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setSelectedSectionDetail(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
