import React from 'react';
import { PieChart } from 'lucide-react';

/**
 * AcademicSnapshotCard - Academic progress snapshot for admin dashboard
 */
export default function AcademicSnapshotCard({ stats, onNavigate }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PieChart size={16} /> Academic Snapshot
        </span>
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
            <span className="text-muted">Student face enrollment</span>
            <strong>{stats.enrolledPct}%</strong>
          </div>
          <div className="dashboard-progress-track">
            <div
              className="dashboard-progress-bar"
              style={{ width: `${stats.enrolledPct}%`, background: 'var(--success)' }}
            />
          </div>
        </div>

        <div className="dashboard-mini-stat">
          <span className="text-muted" style={{ fontSize: '12px' }}>Programs &amp; structure</span>
          <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
            <div>
              <strong>{stats.totalSubjects}</strong>{' '}
              <span className="text-muted" style={{ fontSize: '12px' }}>subjects</span>
            </div>
            <div>
              <strong>{stats.totalSections}</strong>{' '}
              <span className="text-muted" style={{ fontSize: '12px' }}>sections</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => onNavigate('session_logs')}
          style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span>All Session Logs</span>
        </button>
      </div>
    </div>
  );
}
