import React, { useState, useEffect } from 'react';
import { Calendar, Plus, X, Check, Clock, Building } from 'lucide-react';
import { Api } from '../api';

export default function SchedulesView({ user }) {
  const [schedules, setSchedules] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    section: '',
    day_of_week: 'mon',
    start_time: '08:00',
    end_time: '09:30',
    room: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [schList, secList] = await Promise.all([
        Api.getSchedules(),
        Api.getSections(),
      ]);
      setSchedules(schList);
      setSections(secList);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.section || !formData.start_time || !formData.end_time) {
      setErrorMsg('Section, start time, and end time are required.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      await Api.createSchedule(formData);
      setSuccessMsg('Schedule created successfully!');
      setShowAddModal(false);
      setFormData({ section: '', day_of_week: 'mon', start_time: '08:00', end_time: '09:30', room: '' });
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div className="page-content" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            Schedules
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
            All class meeting schedules and their effective date windows
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Add Schedule</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', margin: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Section</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Day</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Time</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Room</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading schedules...
                  </td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No schedules registered yet.{' '}
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
                schedules.map((sch) => (
                  <tr key={sch.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {sch.section_name}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="badge badge-info" style={{ fontWeight: '700' }}>
                        {sch.day_display}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', fontSize: '13px' }}>
                      {sch.start_time} – {sch.end_time}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {sch.room || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Schedule Modal */}
      {showAddModal && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-card modal-md" style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="modal-header" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="modal-title" style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--primary)' }} />
                <span>Add Class Schedule</span>
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

                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                    Class Section *
                  </label>
                  <select
                    className="form-select"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    required
                  >
                    <option value="">Select section...</option>
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.school_year})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      Day of Week *
                    </label>
                    <select
                      className="form-select"
                      value={formData.day_of_week}
                      onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                    >
                      <option value="mon">Monday</option>
                      <option value="tue">Tuesday</option>
                      <option value="wed">Wednesday</option>
                      <option value="thu">Thursday</option>
                      <option value="fri">Friday</option>
                      <option value="sat">Saturday</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      Room Assignment
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. CB 204, Lab 3"
                      value={formData.room}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      Start Time *
                    </label>
                    <input
                      type="time"
                      className="form-control"
                      value={formData.start_time}
                      onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      End Time *
                    </label>
                    <input
                      type="time"
                      className="form-control"
                      value={formData.end_time}
                      onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 22px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <Check size={16} />
                  <span>{submitting ? 'Creating...' : 'Create Schedule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
