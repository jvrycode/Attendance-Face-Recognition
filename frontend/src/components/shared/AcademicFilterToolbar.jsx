import { Filter } from 'lucide-react';

const toolbarStyles = {
  card: {
    padding: '14px 18px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap',
  },
  title: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '7px',
    fontWeight: 700,
    fontSize: '13px',
  },
  actions: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
  },
  resultCount: {
    color: 'var(--text-muted)',
    fontSize: '12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
    gap: '10px',
    alignItems: 'end',
  },
  field: {
    minWidth: 0,
    margin: 0,
  },
  label: {
    display: 'block',
    marginBottom: '4px',
    color: 'var(--text-secondary)',
    fontSize: '11.5px',
    fontWeight: 600,
  },
  // Height/font come from styles/filters.css so every filter stays consistent.
  select: {
    width: '100%',
    minWidth: 0,
  },
};

export default function AcademicFilterToolbar({
  title,
  hasActiveFilters = false,
  onReset,
  resultCount,
  resultTotal,
  resultLabel = 'results',
  children,
}) {
  return (
    <div className="card mb-3 academic-filter-toolbar" style={toolbarStyles.card}>
      <div style={toolbarStyles.header}>
        <span style={toolbarStyles.title}>
          <Filter size={15} />
          {title}
          {hasActiveFilters && <span className="badge badge-primary" style={{ fontSize: '11px', padding: '2px 8px' }}>Active Filters</span>}
        </span>
        <div style={toolbarStyles.actions}>
          {resultCount !== undefined && (
            <span style={toolbarStyles.resultCount}>
              Showing <strong>{resultCount}</strong> of <strong>{resultTotal}</strong> {resultLabel}
            </span>
          )}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onReset}
            disabled={!hasActiveFilters}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: hasActiveFilters ? 1 : 0.55 }}
          >
            Reset
          </button>
        </div>
      </div>
      <div className="academic-filter-grid" style={toolbarStyles.grid}>{children}</div>
    </div>
  );
}

export function AcademicFilterField({ label, children, ...props }) {
  return (
    <label className="form-group" style={toolbarStyles.field} {...props}>
      <span style={toolbarStyles.label}>{label}</span>
      {children}
    </label>
  );
}

export function AcademicFilterSelect({ children, ...props }) {
  return <select className="form-select" style={toolbarStyles.select} {...props}>{children}</select>;
}
