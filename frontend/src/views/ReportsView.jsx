import React, { useState, useEffect } from 'react';
import { BarChart2, Camera, CircleDot, FileText, CheckCircle2, Users } from 'lucide-react';
import { Api } from '../api';
import ActionPopover from '../components/ActionPopover';

export default function ReportsView({ user, onNavigate, onStartSession, onSetHeaderInfo }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const role = user?.role || 'admin';

  useEffect(() => {
    async function loadSessions() {
      try {
        setLoading(true);
        const data = await Api.getSessions();
        setSessions(data || []);
      } catch (err) {
        console.error('Failed to load session logs:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSessions();
  }, []);

  useEffect(() => {
    if (onSetHeaderInfo) {
      onSetHeaderInfo({
        title: user?.role === 'student' ? 'My Records' : 'Session Logs',
        subtitle: 'Past attendance sessions and verified scan logs',
        headerActions: null,
      });
    }
  }, [user, onSetHeaderInfo]);

  return (
    <div className="page-content">

      <div className="card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="table-container" style={{ border: 'none', margin: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Date</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Section</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Subject</th>
                {role !== 'teacher' && (
                  <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Faculty</th>
                )}
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '12px 18px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={role !== 'teacher' ? 6 : 5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading session records...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={role !== 'teacher' ? 6 : 5} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No sessions logged yet.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 18px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {s.date}
                    </td>
                    <td style={{ padding: '14px 18px', fontWeight: '700' }}>
                      {s.schedule_details?.section_name || 'Class Section'}
                    </td>
                    <td style={{ padding: '14px 18px' }}>
                      <span className="badge badge-accent" style={{ fontSize: '11px', fontWeight: '700' }}>
                        {s.schedule_details?.subject_code || 'CS 101'}
                      </span>
                    </td>
                    {role !== 'teacher' && (
                      <td style={{ padding: '14px 18px', color: 'var(--text-muted)', fontSize: '13px' }}>
                        {s.started_by_name || '—'}
                      </td>
                    )}
                    <td style={{ padding: '14px 18px' }}>
                      {s.status === 'open' ? (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700' }}>
                          <CircleDot size={10} /> Open
                        </span>
                      ) : (
                        <span className="badge badge-muted" style={{ fontSize: '11px', fontWeight: '600' }}>
                          Closed
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <ActionPopover
                        items={(() => {
                          const items = [];
                          // ONLY TEACHERS CAN ACCESS ATTENDANCE SCANNER
                          if (role === 'teacher' && s.status === 'open') {
                            items.push({
                              label: 'Resume Scanner',
                              icon: Camera,
                              isPrimary: true,
                              onClick: () => {
                                if (onStartSession) onStartSession(s);
                                else if (onNavigate) onNavigate('scanner');
                              },
                            });
                            items.push({ isDivider: true });
                          }
                          items.push({
                            label: 'Session Report',
                            icon: FileText,
                            onClick: () => {
                              if (onNavigate) onNavigate('section_report');
                            },
                          });
                          return items;
                        })()}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
