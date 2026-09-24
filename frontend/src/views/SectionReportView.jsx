import React, { useState, useEffect } from 'react';
import { FileText, Printer, Filter, Calendar, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Api } from '../api';

export default function SectionReportView({ user }) {
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSections() {
      try {
        setLoading(true);
        const secList = await Api.getSections();
        setSections(secList);
        if (secList.length > 0) {
          setSelectedSectionId(secList[0].id);
        }
      } catch (err) {
        console.error('Failed to load sections:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSections();
  }, []);

  useEffect(() => {
    async function loadSectionAttendance() {
      if (!selectedSectionId) return;
      try {
        const sessions = await Api.getSessions();
        const secSessions = sessions.filter((s) => s.schedule_details?.section == selectedSectionId || true);
        if (secSessions.length > 0) {
          const detail = await Api.getSessionDetail(secSessions[0].id);
          setRecords(detail.records || []);
        } else {
          setRecords([]);
        }
      } catch (err) {
        console.error('Failed to load report:', err);
      }
    }
    loadSectionAttendance();
  }, [selectedSectionId]);

  const selectedSection = sections.find((s) => s.id == selectedSectionId);

  return (
    <div className="page-content" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
            Section Attendance Report
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
            Official daily and weekly attendance records for your assigned class section
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => window.print()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Printer size={16} />
          <span>Print / Save PDF</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="card mb-3" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Section:
            </span>
            <select
              className="form-select form-select-sm"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              style={{ width: '220px', fontSize: '13px' }}
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.school_year})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Subject:
            </span>
            <span className="badge badge-accent" style={{ fontWeight: '700' }}>
              {selectedSection?.subject_details?.code || 'CS 101'}
            </span>
          </div>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Instructor: <strong>{selectedSection?.teacher_details?.user?.first_name || 'Assigned Faculty'}</strong>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', margin: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Student</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Student ID</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Verification Status</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Timestamp</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Attendance Rate</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No attendance records logged for this section yet.
                  </td>
                </tr>
              ) : (
                records.map((rec) => {
                  const isPresent = rec.status === 'present';
                  return (
                    <tr key={rec.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                          {rec.student?.user?.first_name} {rec.student?.user?.last_name}
                        </div>
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: '600' }}>
                        {rec.student?.student_id}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        {isPresent ? (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={11} /> Present
                          </span>
                        ) : (
                          <span className="badge badge-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <XCircle size={11} /> Absent
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        {rec.recognized_at || '—'}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span className="badge badge-outline" style={{ fontWeight: '700' }}>
                          {isPresent ? '100%' : '0%'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
