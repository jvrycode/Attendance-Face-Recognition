import React from 'react';
import { Menu, Radio, LogOut } from 'lucide-react';

export default function Header({ user, title, onToggleSidebar, onLogout }) {
  return (
    <header className="top-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          type="button"
          className="header-menu-btn"
          onClick={onToggleSidebar}
          aria-label="Open navigation"
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        >
          <Menu size={20} />
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
          {title}
        </h1>
      </div>

      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '4px 10px' }}>
          <Radio size={14} className="pulse-indicator" />
          <span>TiDB Cloud Connected</span>
        </div>

        <div className="header-user-chip" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <span style={{ fontSize: '13px', fontWeight: '600' }}>
            {user?.first_name || user?.username}
          </span>
          <span className="badge badge-neutral" style={{ textTransform: 'capitalize', fontSize: '11px', padding: '2px 6px' }}>
            {user?.role}
          </span>
        </div>

        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onLogout}
          title="Sign Out"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px' }}
        >
          <LogOut size={15} />
          <span>Exit</span>
        </button>
      </div>
    </header>
  );
}
