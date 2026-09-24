import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, X, Check, Building, Trash2 } from 'lucide-react';
import { Api } from '../api';

export default function SubjectsView({ user, onSetHeaderInfo }) {
  const [subjects, setSubjects] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [sections, setSections] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    units: 3,
    description: '',
    program: '',
    section: '',
    teacher: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [subjList, progList, secList, teacherList] = await Promise.all([
        Api.getSubjects(),
        Api.getPrograms(),
        Api.getSections(),
        Api.getTeachers(),
      ]);
      setSubjects(subjList);
      setPrograms(progList);
      setSections(secList);
      setTeachers(teacherList);
    } catch (err) {
      console.error('Failed to load subjects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (onSetHeaderInfo) {
      onSetHeaderInfo({
        title: 'Subjects',
        subtitle: 'Academic course subjects and section assignments',
        headerActions: isAdmin ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Add Subject</span>
          </button>
        ) : null,
      });
    }
  }, [isAdmin, onSetHeaderInfo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code || !formData.name) {
      setErrorMsg('Subject code and name are required.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      const payload = {
        code: formData.code,
        name: formData.name,
        units: parseInt(formData.units, 10) || 3,
        description: formData.description || '',
        program: formData.program || null,
        section: formData.section || null,
        teacher: formData.teacher || null,
      };
      await Api.createSubject(payload);
      setSuccessMsg(`Subject "${formData.code}" created successfully!`);
      setShowAddModal(false);
      setFormData({ code: '', name: '', units: 3, description: '', program: '', section: '', teacher: '' });
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create subject offering.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Are you sure you want to delete subject "${code}"?`)) return;
    try {
      await Api.deleteSubject(id);
      setSuccessMsg(`Subject ${code} deleted.`);
      loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete subject.');
    }
  };

  // Filter sections if program is selected
  const filteredSections = formData.program
    ? sections.filter((s) => String(s.program) === String(formData.program))
    : sections;

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

      <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', margin: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Code</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subject Name</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Program</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Linked Section</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Instructor</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Units</th>
                {isAdmin && <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading subjects...
                  </td>
                </tr>
              ) : subjects.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No subjects found.{' '}
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
                subjects.map((sub) => (
                  <tr key={sub.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="badge badge-accent" style={{ fontSize: '12px', fontWeight: '700' }}>
                        {sub.code}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{sub.name}</div>
                      {sub.description && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {sub.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {sub.program_details ? (
                        <span className="badge badge-info">{sub.program_details.code}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {sub.section_name ? (
                        <span className="badge badge-outline" style={{ fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Building size={12} /> {sub.section_name}
                        </span>
                      ) : (
                        <span className="text-muted">Unlinked</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {sub.teacher_details?.user
                        ? `${sub.teacher_details.user.first_name} ${sub.teacher_details.user.last_name}`
                        : '—'}
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: '13px', fontWeight: '600' }}>
                      {sub.units || 3}
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm text-danger"
                          onClick={() => handleDelete(sub.id, sub.code)}
                          title="Delete Subject"
                          style={{ padding: '4px 8px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Subject Modal */}
      {showAddModal && (
        <div
          className="modal-backdrop open"
          style={{ display: 'flex', opacity: 1, zIndex: 1200 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="modal-card modal-lg" style={{ width: '100%', maxWidth: '580px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="modal-header" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="modal-title" style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={18} style={{ color: 'var(--primary)' }} />
                <span>Add Subject Offering</span>
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

            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {errorMsg && (
                  <div className="alert alert-danger" style={{ fontSize: '13px', padding: '10px 14px' }}>
                    {errorMsg}
                  </div>
                )}

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      1. Academic Program *
                    </label>
                    <select
                      className="form-select"
                      value={formData.program}
                      onChange={(e) => setFormData({ ...formData, program: e.target.value, section: '' })}
                      required
                    >
                      <option value="">Select program...</option>
                      {programs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name}
                        </option>
                      ))}
                    </select>
                    <span className="form-text" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Filters available sections.</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      2. Class Section (Optional)
                    </label>
                    <select
                      className="form-select"
                      value={formData.section}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    >
                      <option value="">Choose section offering...</option>
                      {filteredSections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.school_year})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                    3. Assigned Instructor / Teacher (Optional)
                  </label>
                  <select
                    className="form-select"
                    value={formData.teacher}
                    onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
                  >
                    <option value="">Choose instructor...</option>
                    {teachers.map((t) => (
                      <option key={t.id || t.username} value={t.teacher_profile?.id || t.id}>
                        {t.first_name ? `${t.first_name} ${t.last_name || ''}` : t.username} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      Subject Code *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. CS101, IT 473, ACT 101"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      Units *
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      value={formData.units}
                      onChange={(e) => setFormData({ ...formData, units: e.target.value })}
                      min="1"
                      max="10"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                    Full Subject Name *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. System Integration and Architecture"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                    Description / Course Topics (Optional)
                  </label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Brief description of course syllabus..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 22px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <Check size={16} />
                  <span>{submitting ? 'Saving...' : 'Save Subject'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
