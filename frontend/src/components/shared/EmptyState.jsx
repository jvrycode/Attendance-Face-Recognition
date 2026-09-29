import React from 'react';

/**
 * EmptyState - Reusable empty state component with icon and optional action
 * 
 * @param {object} props
 * @param {React.ReactNode} props.icon - Icon component to display
 * @param {string} props.title - Main title text
 * @param {string} props.message - Description message
 * @param {React.ReactNode} props.action - Optional action button or component
 * @param {number} props.iconSize - Size of the icon in pixels
 * @param {object} props.style - Additional inline styles
 * @param {string} props.className - Additional CSS classes
 * 
 * @example
 * <EmptyState
 *   icon={<Users size={40} />}
 *   title="No users found"
 *   message="Start by adding your first user to the system."
 *   action={
 *     <button className="btn btn-primary" onClick={handleAdd}>
 *       <Plus size={16} /> Add User
 *     </button>
 *   }
 * />
 */
export default function EmptyState({ 
  icon, 
  title, 
  message, 
  action = null,
  iconSize = 40,
  style = {},
  className = ''
}) {
  return (
    <div 
      className={`text-center text-muted ${className}`}
      style={{ 
        padding: '40px 20px', 
        ...style 
      }}
    >
      {icon && (
        <div style={{ marginBottom: '12px', opacity: 0.4 }}>
          {React.isValidElement(icon) 
            ? React.cloneElement(icon, { size: iconSize, style: { margin: '0 auto', display: 'block' } })
            : icon
          }
        </div>
      )}
      {title && (
        <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
          {title}
        </p>
      )}
      {message && (
        <p style={{ fontSize: '13px', marginBottom: action ? '14px' : '0', color: 'var(--text-muted)' }}>
          {message}
        </p>
      )}
      {action && (
        <div style={{ marginTop: '14px' }}>
          {action}
        </div>
      )}
    </div>
  );
}
