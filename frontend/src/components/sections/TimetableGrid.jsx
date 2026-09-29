import React from 'react';
import { Calendar } from 'lucide-react';
import { formatSchoolScheduleParts } from '../../utils/time';

export default function TimetableGrid({ schedules = [] }) {
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="card mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div className="card-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="card-title" style={{ fontSize: '15px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Calendar size={18} style={{ color: 'var(--primary)' }} /> Weekly Class Schedule Graph</span>
        <span className="badge badge-info" style={{ fontWeight: 600 }}>{schedules.length} Scheduled Meeting{schedules.length !== 1 ? 's' : ''} / Week</span>
      </div>
      <div style={{ padding: '18px', overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', minWidth: '700px' }}>
          {daysOfWeek.map((dayName) => {
            const dayShort = dayName.slice(0, 3).toLowerCase();
            const daySchedules = schedules.filter((schedule) => (schedule.day_of_week && schedule.day_of_week.toLowerCase() === dayShort) || (schedule.day_2 && schedule.day_2.toLowerCase() === dayShort));
            return <div key={dayName} style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}><div style={{ fontWeight: 700, fontSize: '13px', borderBottom: '1px solid var(--border)', paddingBottom: '6px', color: 'var(--text-primary)' }}>{dayName}</div>{daySchedules.length === 0 ? <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '16px 0', textAlign: 'center' }}>No classes</div> : daySchedules.map((schedule) => { const parts = formatSchoolScheduleParts(schedule); return <div key={schedule.id} style={{ padding: '8px 10px', background: 'var(--accent-light)', borderLeft: '3px solid var(--accent)', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}><div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{schedule.section_name}</div><div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '10.5px', marginTop: '2px' }}>{parts.time || parts.fullTime}</div><div style={{ color: 'var(--text-secondary)', fontSize: '10px', marginTop: '1px' }}>{parts.room || schedule.room || 'TBA'}</div></div>; })}</div>;
          })}
        </div>
      </div>
    </div>
  );
}
