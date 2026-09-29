import React from 'react';

/** The single spinner used everywhere in the app. */
export function Spinner({ size = 'md', label, className = '' }) {
  return (
    <span className={`ui-spinner ui-spinner-${size} ${className}`.trim()} role={label ? 'status' : undefined} aria-label={label}>
      {!label && <span className="sr-only">Loading</span>}
    </span>
  );
}

/** Centered loader for a page or panel that is fetching its first data. */
export function PageLoader({ label = 'Loading…', hint, compact = false }) {
  return (
    <div className={`ui-page-loader ${compact ? 'is-compact' : ''}`} role="status" aria-live="polite">
      <Spinner size={compact ? 'md' : 'lg'} />
      <p className="ui-page-loader-label">{label}</p>
      {hint && <p className="ui-page-loader-hint">{hint}</p>}
    </div>
  );
}

/** Loading placeholder for table bodies. */
export function TableLoadingRow({ colSpan = 1, label = 'Loading records…' }) {
  return (
    <tr className="ui-table-state-row">
      <td colSpan={colSpan}>
        <PageLoader label={label} compact />
      </td>
    </tr>
  );
}

/**
 * Text button with a built-in spinner. The global loader already adds a
 * spinner to any button whose click triggers an API call; use `loading` for
 * work that is not an API call (camera capture, local processing).
 */
export function Button({ loading = false, loadingText, variant = 'primary', size, className = '', children, disabled, type = 'button', ...rest }) {
  const classes = ['btn', `btn-${variant}`, size ? `btn-${size}` : '', className].filter(Boolean).join(' ');
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      data-loading={loading ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      {...rest}
    >
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

export default Spinner;
