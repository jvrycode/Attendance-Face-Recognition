import React from 'react';

/**
 * FilterTabs - Reusable filter tabs component
 * 
 * @param {object} props
 * @param {Array<{value: string, label: string}>} props.tabs - Array of tab objects with value and label
 * @param {string} props.activeTab - Currently active tab value
 * @param {function} props.onTabChange - Handler when tab is clicked
 * @param {object} props.style - Additional inline styles
 * @param {string} props.className - Additional CSS classes
 * 
 * @example
 * <FilterTabs
 *   tabs={[
 *     { value: 'all', label: 'All' },
 *     { value: 'active', label: 'Active' },
 *     { value: 'inactive', label: 'Inactive' }
 *   ]}
 *   activeTab={filter}
 *   onTabChange={setFilter}
 * />
 */
export default function FilterTabs({ 
  tabs = [], 
  activeTab, 
  onTabChange, 
  style = {},
  className = ''
}) {
  return (
    <div style={{ display: 'flex', gap: '6px', ...style }} className={className}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={`btn btn-sm ${activeTab === tab.value ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => onTabChange(tab.value)}
          style={{ textTransform: 'capitalize', padding: '6px 12px' }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
