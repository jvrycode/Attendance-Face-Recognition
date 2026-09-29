import React from 'react';
import { Zap } from 'lucide-react';

/**
 * QuickActionsCard - Quick action buttons for admin dashboard
 */
export default function QuickActionsCard({ onNavigate }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={16} /> Quick Actions
        </span>
      </div>
      <div className="card-body dashboard-action-grid">
        <button type="button" className="btn btn-primary" onClick={() => onNavigate('users')}>
          <span>Register Student</span>
        </button>
        <button type="button" className="btn btn-outline" onClick={() => onNavigate('users')}>
          <span>Add Faculty / Staff</span>
        </button>
        <button type="button" className="btn btn-outline" onClick={() => onNavigate('sections')}>
          <span>Add Section</span>
        </button>
        <button type="button" className="btn btn-outline" onClick={() => onNavigate('schedules')}>
          <span>Add Schedule</span>
        </button>
        <button type="button" className="btn btn-outline" onClick={() => onNavigate('users')}>
          <span>User Management</span>
        </button>
        <button type="button" className="btn btn-outline" onClick={() => onNavigate('face_enrollment')}>
          <span>Face Enrollment</span>
        </button>
      </div>
    </div>
  );
}
