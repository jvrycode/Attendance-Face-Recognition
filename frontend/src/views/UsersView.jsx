import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  UserCheck,
  Shield,
  GraduationCap,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Api, apiRequest } from '../api';

export default function UsersView() {
  const [users, setUsers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    role: 'teacher',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    employee_id: '',
    department: '',
    specialization: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    loadUsers();
    loadPrograms();
  }, []);

  async function loadUsers() {
    try {
      setLoading(true);
      const data = await Api.getUsers();
      setUsers(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPrograms() {
    try {
      const res = await apiRequest('/api/programs/');
      if (res.ok) {
        const data = await res.json();
        setPrograms(data);
      }
    } catch {
      // Fallback official programs if API is not yet loaded
      setPrograms([
        { id: 1, code: 'CITEC', name: 'College of Information, Technology, Entertainment, and Computing' },
        { id: 2, code: 'CCJE', name: 'College of Criminal Justice Education' },
        { id: 3, code: 'CTE', name: 'College of Teacher Education' },
        { id: 4, code: 'CoA', name: 'College of Accountancy' },
        { id: 5, code: 'CoN', name: 'College of Nursing' },
        { id: 6, code: 'CAS', name: 'College of Arts and Sciences' },
        { id: 7, code: 'CORE', name: 'College of Operations, Resources, and Entrepreneurship' },
        { id: 8, code: 'CEnTech', name: 'College of Engineering and Technology' },
        { id: 9, code: 'CIHT', name: 'College of Innovative Hospitality and Tourism' },
      ]);
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.first_name || !formData.last_name || !formData.email || !formData.password) {
      setFormError('Please fill in all required fields.');
      return;
    }
    if (formData.password !== formData.confirm_password) {
      setFormError('Passwords do not match.');
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      await Api.createUser(formData);
      setSuccessMsg(`User ${formData.first_name} ${formData.last_name} (${formData.role}) created successfully!`);
      setShowAddModal(false);
      setFormData({
        username: '',
        role: 'teacher',
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        password: '',
        confirm_password: '',
        employee_id: '',
        department: '',
        specialization: '',
      });
      await loadUsers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setFormError(err.message || 'Failed to create user');
    } finally {
      setFormLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      u.username?.toLowerCase().includes(q) ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q);
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="page-content" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Title & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0' }}>User Management</h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '13px' }}>
            System accounts, faculty profiles, and student access credentials
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          <span>Add Staff / Faculty</span>
        </button>
      </div>

      {successMsg && (
        <div className="alert alert-success" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="card" style={{ padding: '16px', border: '1px solid var(--border)', background: 'var(--bg-card)', borderRadius: 'var(--radius)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'admin', 'teacher', 'student'].map((r) => (
              <button
                key={r}
                type="button"
                className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setRoleFilter(r)}
                style={{ textTransform: 'capitalize', padding: '6px 12px' }}
              >
                {r === 'all' ? 'All Roles' : `${r}s`}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search user by name, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '34px', width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Profile Info</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No users match your filter.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id || u.username}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="user-avatar" style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--accent-light)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px' }}>
                          {(u.first_name?.[0] || u.username?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600' }}>{u.first_name ? `${u.first_name} ${u.last_name || ''}` : u.username}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-danger' : u.role === 'teacher' ? 'badge-info' : 'badge-neutral'}`} style={{ textTransform: 'capitalize' }}>
                        {u.role}
                      </span>
                    </td>
                    <td>{u.email || '—'}</td>
                    <td>{u.phone || '—'}</td>
                    <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      {u.teacher_profile?.department || u.student_profile?.course || 'Standard Access'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── ADD STAFF / FACULTY MODAL (Exact Copycat with Department Dropdown) ─── */}
      {showAddModal && (
        <div className="modal-backdrop open" style={{ display: 'flex' }} onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="modal-card" style={{ maxWidth: '640px', width: '100%', borderRadius: 'var(--radius-lg)', background: 'var(--bg-card)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={18} color="var(--accent)" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>Add Staff / Faculty Account</h3>
              </div>
              <button type="button" onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="modal-body" style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
                {formError && (
                  <div className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '13px' }}>
                    <AlertCircle size={15} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid-2" style={{ gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Username *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="e.g. jdoe"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Role *</label>
                    <select
                      className="form-select"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      placeholder="First Name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                      placeholder="Last Name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. jdoe@attendfr.edu"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. 09123456789"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Confirm Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={formData.confirm_password}
                      onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Faculty Profile with Department DROPDOWN */}
                {formData.role === 'teacher' && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '8px' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-secondary)' }}>
                      Faculty Profile
                    </h4>
                    <div className="grid-2" style={{ gap: '14px' }}>
                      <div className="form-group">
                        <label className="form-label">Faculty ID (FAC-ID) *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.employee_id}
                          onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                          placeholder="e.g. FAC-2026-001"
                        />
                      </div>

                      {/* 🌟 Dynamic Department Dropdown populated with Program entities */}
                      <div className="form-group">
                        <label className="form-label">Department / Program *</label>
                        <select
                          className="form-select"
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          required
                        >
                          <option value="">Select Program / Department</option>
                          {programs.map((p) => (
                            <option key={p.id || p.code} value={p.name || p.code}>
                              {p.code} - {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Specialization</label>
                        <input
                          type="text"
                          className="form-control"
                          value={formData.specialization}
                          onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                          placeholder="e.g. Software Engineering, AI & Robotics"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {formLoading ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
                  <span>Create Staff User</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
