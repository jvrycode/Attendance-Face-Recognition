import React from 'react';
import {
  GraduationCap,
  Home,
  Award,
  Layers,
  Building,
  BookOpen,
  Calendar,
  Users,
  Camera,
  FileText,
  BarChart2,
  Settings,
  LogOut,
  X,
} from 'lucide-react';

export default function Sidebar({ user, activeTab, setActiveTab, onLogout, isOpen, onClose }) {
  const role = user?.role || 'student';

  const NavLink = ({ id, label, icon: Icon }) => (
    <button
      type="button"
      className={`nav-item ${activeTab === id ? 'active' : ''}`}
      onClick={() => {
        setActiveTab(id);
        if (onClose) onClose();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        textAlign: 'left',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <span className="icon" style={{ display: 'inline-flex', marginRight: '10px' }}>
        <Icon size={18} />
      </span>
      <span>{label}</span>
    </button>
  );

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} id="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="sidebar-logo-icon">
            <GraduationCap size={22} />
          </div>
          <div className="sidebar-logo-text">
            <h2>AttendFR</h2>
            <p>Attendance System</p>
          </div>
        </div>
        {onClose && (
          <button type="button" className="sidebar-close-btn" onClick={onClose} aria-label="Close navigation">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Main</div>
        <NavLink id="dashboard" label="Dashboard" icon={Home} />

        {role === 'admin' && (
          <>
            <div className="nav-section-label">Academic Structure</div>
            <NavLink id="programs" label="Programs" icon={Award} />
            <NavLink id="sections" label="Class Sections" icon={Building} />
            <NavLink id="schedules" label="Schedules" icon={Calendar} />

            <div className="nav-section-label">Management</div>
            <NavLink id="users" label="Users" icon={Users} />
            <NavLink id="scanner" label="Live Scanner" icon={Camera} />

            <div className="nav-section-label">Reports</div>
            <NavLink id="reports" label="Session Logs" icon={BarChart2} />
          </>
        )}

        {role === 'teacher' && (
          <>
            <div className="nav-section-label">Teaching</div>
            <NavLink id="sections" label="Section & Schedule" icon={Calendar} />
            <NavLink id="scanner" label="Live Scanner" icon={Camera} />

            <div className="nav-section-label">Reports</div>
            <NavLink id="reports" label="Attendance Reports" icon={FileText} />
          </>
        )}

        {role === 'student' && (
          <>
            <div className="nav-section-label">Academics</div>
            <NavLink id="sections" label="My Schedule" icon={Calendar} />

            <div className="nav-section-label">My Attendance</div>
            <NavLink id="reports" label="My Records" icon={BarChart2} />
          </>
        )}

        <div className="nav-section-label">Account</div>
        <button
          type="button"
          className="nav-item"
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            textAlign: 'left',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--danger)',
          }}
        >
          <span className="icon" style={{ display: 'inline-flex', marginRight: '10px' }}>
            <LogOut size={18} />
          </span>
          <span>Sign Out</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="user-badge" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="user-avatar" style={{ fontWeight: '700' }}>
            {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
          </div>
          <div className="user-info" style={{ overflow: 'hidden' }}>
            <div className="user-name" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username}
            </div>
            <div className="user-role" style={{ textTransform: 'capitalize' }}>
              {user?.role}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
