import React, { useState, useEffect } from 'react';
import { PageLoader } from '../ui';
import { User,  Camera, CheckCircle, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { Api, resolveMediaUrl } from '../api';
import Toast from '../components/shared/Toast';
import PhoneInput from '../components/shared/PhoneInput';

export default function StudentProfileView({ onUserUpdated, onSetHeaderInfo }) {
  const [editing, setEditing] = useState(false);
  const ph = (example) => (editing ? example : 'Not provided');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [profile, setProfile] = useState(null);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (onSetHeaderInfo) {
      onSetHeaderInfo({
        title: 'My Profile',
        subtitle: 'View and edit your personal information',
        headerActions: !editing ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setEditing(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Edit Profile</span>
          </button>
        ) : null,
      });
    }
  }, [onSetHeaderInfo, editing]);

  async function loadProfile() {
    try {
      setLoading(true);
      const data = await Api.getMe();
      setProfile(data);
      setFormData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        email: data.email || '',
        phone: data.phone || '',
        middle_name: data.student_profile?.middle_name || '',
        birth_date: data.student_profile?.birth_date || '',
        birth_place: data.student_profile?.birth_place || '',
        gender: data.student_profile?.gender || 'Male',
        civil_status: data.student_profile?.civil_status || 'Single',
        religion: data.student_profile?.religion || '',
        citizenship: data.student_profile?.citizenship || '',
        blood_type: data.student_profile?.blood_type || '',
        height: data.student_profile?.height || '',
        languages_spoken: data.student_profile?.languages_spoken || '',
        current_address: data.student_profile?.current_address || '',
        current_region: data.student_profile?.current_region || '',
        current_province: data.student_profile?.current_province || '',
        current_municipality: data.student_profile?.current_municipality || '',
        permanent_address: data.student_profile?.permanent_address || '',
        permanent_region: data.student_profile?.permanent_region || '',
        permanent_province: data.student_profile?.permanent_province || '',
        permanent_municipality: data.student_profile?.permanent_municipality || '',
        mobile_number: data.student_profile?.mobile_number || '',
        telephone: data.student_profile?.telephone || '',
      });
    } catch (err) {
      setErrorMsg('Failed to load profile');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    try {
      setLoading(true);
      setErrorMsg('');
      const updated = await Api.updateProfile(formData);
      onUserUpdated?.(updated);
      setSuccessMsg('Profile updated successfully!');
      setEditing(false);
      await loadProfile();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  }

  const faceImageUrl = resolveMediaUrl(profile?.student_profile?.face_image || profile?.profile_image);
  const fullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || profile?.username;
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=6366f1&color=fff`;

  if (!profile) {
    return <div className="page-content"><PageLoader label="Loading your profile…" /></div>;
  }

  return (
    <div className="page-content">
      <Toast message={successMsg} type="success" onClose={() => setSuccessMsg('')} />
      <Toast message={errorMsg} type="error" onClose={() => setErrorMsg('')} />

      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Profile Photo & Basic Info */}
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={16} /> Profile Photo & Basic Info
                </span>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                  {faceImageUrl ? (
                    <img
                      src={faceImageUrl}
                      alt="Profile"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = fallbackAvatar;
                      }}
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '3px solid var(--success)',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '28px',
                        fontWeight: 700,
                        color: 'var(--primary)',
                      }}
                    >
                      {(profile.first_name?.[0] || profile.username?.[0] || 'S').toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '18px' }}>{fullName}</div>
                    <div className="text-muted">@{profile.username}</div>
                    <div className="text-muted">Student ID: <strong>{profile.student_profile?.student_id}</strong></div>
                  </div>
                </div>

                {!editing && (
                  <div className="alert alert-info" style={{ fontSize: '12px' }}>
                    <Camera size={14} style={{ marginRight: '6px' }} />
                    To update your profile photo, contact your administrator for face enrollment.
                  </div>
                )}

                <div className="grid-2" style={{ gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                      disabled={!editing}
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
                      disabled={!editing}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Middle Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.middle_name}
                      onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                      disabled={!editing}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Academic Info (Read-only) */}
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} /> Academic Information
                </span>
              </div>
              <div className="card-body">
                <div className="alert alert-warning" style={{ fontSize: '12px', marginBottom: '14px' }}>
                  Academic information can only be updated by administrators.
                </div>
                <div className="grid-2" style={{ gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Program</label>
                    <input
                      type="text"
                      className="form-control"
                      value={profile.student_profile?.display_academic_program || profile.student_profile?.course || 'BSIT'}
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Year Level</label>
                    <input
                      type="text"
                      className="form-control"
                      value={`${profile.student_profile?.year_level || 1}${['st', 'nd', 'rd', 'th'][Math.min(3, (profile.student_profile?.year_level || 1) - 1)]} Year`}
                      disabled
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Details */}
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={16} /> Personal Details
                </span>
              </div>
              <div className="card-body">
                <div className="grid-2" style={{ gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.birth_date}
                      onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                      disabled={!editing}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Place of Birth</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.birth_place}
                      onChange={(e) => setFormData({ ...formData, birth_place: e.target.value })}
                      disabled={!editing}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <select
                      className="form-select"
                      value={formData.gender}
                      onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      disabled={!editing}
                    >
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Civil Status</label>
                    <select
                      className="form-select"
                      value={formData.civil_status}
                      onChange={(e) => setFormData({ ...formData, civil_status: e.target.value })}
                      disabled={!editing}
                    >
                      <option>Single</option>
                      <option>Married</option>
                      <option>Widowed</option>
                      <option>Separated</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Religion</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.religion}
                      onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                      disabled={!editing}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Citizenship</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.citizenship}
                      onChange={(e) => setFormData({ ...formData, citizenship: e.target.value })}
                      disabled={!editing}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Contact Information */}
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={16} /> Contact Information
                </span>
              </div>
              <div className="card-body">
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Email Address *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!editing}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label">Mobile Number</label>
                  <PhoneInput
                    value={formData.mobile_number}
                    onChange={(e) => setFormData({ ...formData, mobile_number: e.target.value })}
                    disabled={!editing}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Telephone / Landline</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    disabled={!editing}
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={16} /> Current Address
                </span>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Full Address</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={formData.current_address}
                    onChange={(e) => setFormData({ ...formData, current_address: e.target.value })}
                    disabled={!editing}
                    placeholder={ph('House#/Street Name, Barangay, City, Province')}
                  />
                </div>
              </div>
            </div>

            {/* Health, language & permanent address */}
            <div className="card">
              <div className="card-header"><span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={16} /> Health & Permanent Address</span></div>
              <div className="card-body">
                <div className="grid-2" style={{ gap: '14px' }}>
                  <div className="form-group"><label className="form-label">Blood Type</label><input className="form-control" value={formData.blood_type} onChange={(e) => setFormData({ ...formData, blood_type: e.target.value })} disabled={!editing} placeholder={ph('e.g. O+')} /></div>
                  <div className="form-group"><label className="form-label">Height</label><input className="form-control" value={formData.height} onChange={(e) => setFormData({ ...formData, height: e.target.value })} disabled={!editing} placeholder={ph('e.g. 165 cm')} /></div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Languages Spoken</label><input className="form-control" value={formData.languages_spoken} onChange={(e) => setFormData({ ...formData, languages_spoken: e.target.value })} disabled={!editing} placeholder={ph('e.g. English, Filipino, Cebuano')} /></div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Permanent Address</label><textarea className="form-control" rows={3} value={formData.permanent_address} onChange={(e) => setFormData({ ...formData, permanent_address: e.target.value })} disabled={!editing} placeholder={ph('House#/Street Name, Barangay, City, Province')} /></div>
                  <div className="form-group"><label className="form-label">Permanent Region</label><input className="form-control" value={formData.permanent_region} onChange={(e) => setFormData({ ...formData, permanent_region: e.target.value })} disabled={!editing} /></div>
                  <div className="form-group"><label className="form-label">Permanent Province</label><input className="form-control" value={formData.permanent_province} onChange={(e) => setFormData({ ...formData, permanent_province: e.target.value })} disabled={!editing} /></div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}><label className="form-label">Permanent City / Municipality</label><input className="form-control" value={formData.permanent_municipality} onChange={(e) => setFormData({ ...formData, permanent_municipality: e.target.value })} disabled={!editing} /></div>
                </div>
              </div>
            </div>

            {/* Biometric Status */}
            <div className="card">
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Camera size={16} /> Biometric Status
                </span>
              </div>
              <div className="card-body">
                {profile.student_profile?.is_face_enrolled ? (
                  <div className="alert alert-success">
                    <CheckCircle size={16} style={{ marginRight: '8px' }} />
                    Face biometrics enrolled
                    {profile.student_profile?.face_enrolled_at && (
                      <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                        Enrolled on {new Date(profile.student_profile.face_enrolled_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="alert alert-warning">
                    <Camera size={16} style={{ marginRight: '8px' }} />
                    Face biometrics not enrolled. Contact your administrator for enrollment.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {editing && (
          <div
            style={{
              marginTop: '20px',
              padding: '16px 20px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setEditing(false);
                loadProfile();
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
