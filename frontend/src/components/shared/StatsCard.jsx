import React from 'react';

/**
 * StatsCard - Reusable KPI stat card component
 * 
 * @param {object} props
 * @param {string|number} props.value - The main stat value to display
 * @param {string} props.label - The label/description for the stat
 * @param {React.ReactNode} props.icon - Icon component to display
 * @param {string} props.variant - Color variant: 'blue', 'green', 'yellow', 'red', 'info', 'success', 'warning', 'danger', 'accent', or 'neutral'
 * @param {object} props.style - Additional inline styles
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.sublabel - Optional secondary label below main label
 */
export default function StatsCard({ 
  value, 
  label, 
  icon, 
  variant = 'neutral', 
  style = {}, 
  className = '',
  sublabel = ''
}) {
  const variantClass = variant ? variant : '';
  
  return (
    <div className={`stat-card ${variantClass} ${className}`} style={style}>
      {icon && (
        <div className={`stat-icon ${variantClass}`}>
          {icon}
        </div>
      )}
      <div className="stat-info">
        <div className="value">{value}</div>
        <div className="label">{label}</div>
        {sublabel && <div className="sublabel" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{sublabel}</div>}
      </div>
    </div>
  );
}
