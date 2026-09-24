import React, { useState, useEffect } from 'react';
import { Layers, Plus, Filter, X, Check, Building } from 'lucide-react';
import { Api } from '../api';

export default function SectionCatalogView({ user, onSetHeaderInfo }) {
  const [sections, setSections] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    program: '',
    name: '',
    year_level: 1,
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [secList, progList] = await Promise.all([
        Api.getProgramSections(selectedProgramId),
        Api.getPrograms(),
      ]);
      setSections(secList);
      setPrograms(progList);
    } catch (err) {
      console.error('Failed to load section catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProgramId]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (onSetHeaderInfo) {
      onSetHeaderInfo({
        title: 'Section Catalog (Master List)',
        subtitle: 'Stored section definitions grouped by College / Academic Program',
        headerActions: isAdmin ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Add Section Definition</span>
          </button>
        ) : null,
      });
    }
  }, [isAdmin, onSetHeaderInfo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.program) {
      setErrorMsg('Program and section name are required.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      await Api.createProgramSection(formData);
      setSuccessMsg(`Section definition ${formData.name} created successfully!`);
      setShowAddModal(false);
      setFormData({ program: '', name: '', year_level: 1, description: '' });
      await loadData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create section definition.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-content">

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Check size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="card mb-3" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Filter size={14} /> Filter College:
          </span>
          <button
            type="button"
            className={`btn btn-sm ${!selectedProgramId ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setSelectedProgramId(null)}
          >
            All Programs
          </button>
          {programs.map((prog) => (
            <button
              key={prog.id}
              type="button"
              className={`btn btn-sm ${selectedProgramId === prog.id ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setSelectedProgramId(prog.id)}
            >
              {prog.code}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Total Sections: <strong>{sections.length}</strong>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', margin: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>College / Program</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Section Name</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Year Level</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Description / Track</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Active Classes</th>
                {isAdmin && <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading section catalog...
                  </td>
                </tr>
              ) : sections.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No section definitions found.{' '}
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setShowAddModal(true)}
                        style={{ color: 'var(--primary)', cursor: 'pointer', background: 'none', border: 'none', textDecoration: 'underline' }}
                      >
                        Create one
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                sections.map((sec) => (
                  <tr key={sec.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="badge badge-accent" style={{ fontSize: '12px', fontWeight: '700' }}>
                        {sec.program_details?.code || 'CITEC'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {sec.name}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="badge badge-info" style={{ fontWeight: '600' }}>
                        {sec.year_level_display || `${sec.year_level}th Year`}
                      </span>
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      {sec.description || '—'}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="badge badge-outline">
                        {sec.active_classes_count || 1} active
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm text-danger"
                          onClick={async () => {
                            if (!window.confirm(`Are you sure you want to delete definition "${sec.name}"?`)) return;
                            try {
                              await Api.deleteProgramSection(sec.id);
                              setSuccessMsg(`Section definition ${sec.name} deleted.`);
                              loadData();
                              setTimeout(() => setSuccessMsg(''), 4000);
                            } catch (err) {
                              setErrorMsg(err.message || 'Failed to delete definition.');
                            }
                          }}
                          title="Delete Definition"
                          style={{ padding: '4px 8px' }}
                        >
                          <X size={14} />
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

      {/* Add Section Definition Modal */}
      {showAddModal && (
        <div
          className="modal-backdrop open"
          style={{ display: 'flex', opacity: 1, zIndex: 1200 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
        >
          <div className="modal-card modal-md" style={{ width: '100%', maxWidth: '520px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="modal-header" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="modal-title" style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} style={{ color: 'var(--primary)' }} />
                <span>Add Section Definition</span>
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
                      Section Name *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. BSCS-2A, IT 43"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                      Year Level
                    </label>
                    <select
                      className="form-select"
                      value={formData.year_level}
                      onChange={(e) => setFormData({ ...formData, year_level: parseInt(e.target.value) })}
                    >
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px' }}>
                    Description / Track (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Software Engineering Track, Day Shift"
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
