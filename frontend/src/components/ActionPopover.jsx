import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

export default function ActionPopover({ items = [] }) {
  const [open, setOpen] = useState(false);
  const [isDropup, setIsDropup] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!open && dropdownRef.current) {
      const rect = dropdownRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 180 && rect.top > 180) {
        setIsDropup(true);
      } else {
        setIsDropup(false);
      }
    }
    setOpen((prev) => !prev);
  };

  return (
    <div className="action-popover-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`action-popover-trigger ${open ? 'active' : ''}`}
        onClick={handleToggle}
        title="Actions"
        aria-label="Actions"
      >
        <MoreVertical size={16} />
      </button>

      {open && (
        <div className={`action-popover-menu open ${isDropup ? 'dropup open' : ''}`}>
          {items.map((item, idx) => {
            if (item.isDivider) {
              return <div key={`div-${idx}`} className="action-popover-divider" />;
            }
            const Icon = item.icon;
            let className = 'action-popover-item';
            if (item.isDanger) className += ' text-danger';
            else if (item.isPrimary) className += ' text-primary';
            else if (item.isSuccess) className += ' text-success';

            return (
              <button
                key={idx}
                type="button"
                className={className}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  if (item.onClick) item.onClick();
                }}
              >
                {Icon && <Icon size={14} />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
