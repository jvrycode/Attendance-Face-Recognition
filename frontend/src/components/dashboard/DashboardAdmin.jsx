import React from 'react';
import DashboardStats from './DashboardStats';
import QuickActionsCard from './QuickActionsCard';
import AcademicSnapshotCard from './AcademicSnapshotCard';
import SessionsTable from './SessionsTable';

/**
 * DashboardAdmin - Admin dashboard view
 * Shows system-wide statistics, quick actions, and recent sessions
 */
export default function DashboardAdmin({ stats, sessions, sections, onNavigate }) {
  return (
    <div className="page-content">
      {/* Stats Grid */}
      <DashboardStats stats={stats} variant="admin" />

      {/* Quick Actions & Academic Snapshot */}
      <div className="grid-2 mb-3" style={{ alignItems: 'stretch' }}>
        <QuickActionsCard onNavigate={onNavigate} />
        <AcademicSnapshotCard stats={stats} onNavigate={onNavigate} />
      </div>

      {/* Recent Attendance Activity */}
      <SessionsTable 
        sessions={sessions} 
        sections={sections} 
        onNavigate={onNavigate}
        title="Recent Attendance Activity"
        limit={5}
      />
    </div>
  );
}
