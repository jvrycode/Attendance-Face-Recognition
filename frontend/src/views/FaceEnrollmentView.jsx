import React, { useState, useEffect, useRef } from 'react';
import { Camera, Search, UserCheck, AlertCircle, CheckCircle2, X, RefreshCw } from 'lucide-react';
import { Api } from '../api';

export default function FaceEnrollmentView({ user }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [modalMsg, setModalMsg] = useState('');
  const [modalError, setModalError] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const data = await Api.getStudents(search);
      setStudents(data);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [search]);

  const openEnrollModal = async (student) => {
    setSelectedStudent(student);
    setShowModal(true);
    setModalMsg('');
    setModalError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setModalError('Could not open camera. Please grant camera permission.');
    }
  };

  const closeEnrollModal = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setShowModal(false);
    setSelectedStudent(null);
  };

  const handleCaptureAndEnroll = async () => {
    if (!videoRef.current || !selectedStudent) return;

    try {
      setEnrolling(true);
      setModalError('');
      setModalMsg('Analyzing facial embedding...');

      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const frameB64 = canvas.toDataURL('image/jpeg', 0.9);

      const res = await Api.enrollFace(selectedStudent.id, frameB64);
      setModalMsg(res.message || 'Face biometric enrolled successfully!');
      await loadStudents();
      setTimeout(() => {
        closeEnrollModal();
      }, 1800);
    } catch (err) {
      setModalError(err.message || 'Face enrollment failed. Ensure one clear face is centered.');
      setModalMsg('');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="page-content" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            Select Student to Enroll
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
            Enroll or update biometric 128-D face embeddings for students
          </p>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        {/* Card Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)' }}>
            Registered Students <span className="badge badge-info">{students.length}</span>
          </div>
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search student or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '34px', fontSize: '13px' }}
            />
          </div>
        </div>

        <div className="table-container" style={{ border: 'none', margin: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Student</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Student ID</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Course & Year</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Face Status</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading students...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No students found.
                  </td>
                </tr>
              ) : (
                students.map((st) => (
                  <tr key={st.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'var(--primary)' }}>
                          {(st.user?.first_name?.[0] || 'S').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            {st.user?.first_name} {st.user?.last_name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {st.user?.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: '600' }}>
                      {st.student_id}
                    </td>
                    <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {st.course || 'BSCS'} • Year {st.year_level || 1}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      {st.is_face_enrolled ? (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={11} /> Enrolled
                        </span>
                      ) : (
                        <span className="badge badge-warning">
                          Not Enrolled
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => openEnrollModal(st)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <Camera size={13} />
                        <span>{st.is_face_enrolled ? 'Update Face' : 'Enroll Face'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Face Enrollment Modal */}
      {showModal && (
        <div className="modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-card modal-md" style={{ width: '100%', maxWidth: '540px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-xl)', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} style={{ color: 'var(--primary)' }} />
                <span>Enroll Face – {selectedStudent?.user?.first_name} {selectedStudent?.user?.last_name}</span>
              </h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={closeEnrollModal} style={{ padding: '4px', border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {modalError && (
                <div className="alert alert-danger" style={{ fontSize: '13px' }}>
                  {modalError}
                </div>
              )}
              {modalMsg && (
                <div className="alert alert-success" style={{ fontSize: '13px' }}>
                  {modalMsg}
                </div>
              )}

              {/* Viewport with Oval Vignette */}
              <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', background: '#090d16', borderRadius: 'var(--radius)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                />
                <canvas ref={canvasRef} style={{ display: 'none' }} />

                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '220px', height: '280px', borderRadius: '50%', border: '2px dashed rgba(255, 255, 255, 0.6)', boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.3)' }} />
                </div>
              </div>

              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', margin: 0 }}>
                Center the student's face within the oval. Good lighting ensures high recognition accuracy.
              </p>
            </div>

            <div className="modal-footer" style={{ padding: '14px 20px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-outline" onClick={closeEnrollModal}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleCaptureAndEnroll} disabled={enrolling}>
                <Camera size={16} />
                <span>{enrolling ? 'Enrolling...' : 'Capture & Register Face'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
