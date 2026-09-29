import React from 'react';
import { Search } from 'lucide-react';

/**
 * SearchBar - Reusable search input with icon
 * 
 * @param {object} props
 * @param {string} props.value - Current search value
 * @param {function} props.onChange - onChange handler
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.width - Width of the search bar (e.g., '280px', '100%')
 * @param {number} props.iconSize - Size of the search icon in pixels
 * @param {object} props.style - Additional inline styles
 * @param {string} props.className - Additional CSS classes
 */
export default function SearchBar({ 
  value, 
  onChange, 
  placeholder = 'Search...', 
  width = '280px',
  iconSize = 16,
  style = {},
  className = ''
}) {
  return (
    <div style={{ position: 'relative', width, ...style }} className={className}>
      <Search 
        size={iconSize} 
        style={{ 
          position: 'absolute', 
          left: '10px', 
          top: '50%', 
          transform: 'translateY(-50%)', 
          color: 'var(--text-muted)' 
        }} 
      />
      <input
        type="text"
        className="form-control"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        style={{ paddingLeft: '34px', width: '100%' }}
      />
    </div>
  );
}
