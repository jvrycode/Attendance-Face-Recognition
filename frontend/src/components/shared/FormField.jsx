import React from 'react';
import '../../styles/formValidation.css';

/**
 * FormField - Reusable form field component with built-in validation display
 * 
 * @param {String} label - Field label
 * @param {String} name - Field name
 * @param {String} type - Input type (text, email, password, number, date, select, textarea)
 * @param {*} value - Field value
 * @param {Function} onChange - Change handler (value) => void
 * @param {String} error - Error message to display
 * @param {Boolean} required - Whether field is required
 * @param {String} placeholder - Placeholder text
 * @param {Array} options - Options for select (array of {value, label} or strings)
 * @param {Boolean} disabled - Whether field is disabled
 * @param {Object} props - Additional props to pass to input
 */
export default function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  required = false,
  placeholder,
  options = [],
  disabled = false,
  rows = 3,
  helpText,
  ...props
}) {
  const hasError = Boolean(error);
  const inputId = `field-${name}`;
  const inputClassName = `form-control ${hasError ? 'is-invalid' : ''} ${!hasError && value ? 'is-valid' : ''}`;

  const handleChange = (e) => {
    const newValue = type === 'number' ? Number(e.target.value) : e.target.value;
    onChange(newValue);
  };

  return (
    <div className={`form-group ${hasError ? 'has-error' : ''}`}>
      {label && (
        <label 
          htmlFor={inputId} 
          className={`form-label ${required ? 'required' : ''}`}
        >
          {label}
        </label>
      )}
      
      {type === 'select' ? (
        <select
          id={inputId}
          name={name}
          className={`form-select ${hasError ? 'is-invalid' : ''}`}
          value={value || ''}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          {...props}
        >
          <option value="">
            {placeholder || `Select ${label || 'option'}...`}
          </option>
          {options.map((option, index) => {
            const optionValue = typeof option === 'object' ? option.value : option;
            const optionLabel = typeof option === 'object' ? option.label : option;
            return (
              <option key={index} value={optionValue}>
                {optionLabel}
              </option>
            );
          })}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          id={inputId}
          name={name}
          className={inputClassName}
          value={value || ''}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          rows={rows}
          {...props}
        />
      ) : (
        <input
          id={inputId}
          name={name}
          type={type}
          className={inputClassName}
          value={value || ''}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          {...props}
        />
      )}
      
      {helpText && !hasError && (
        <small className="form-text text-muted" style={{ display: 'block', marginTop: '4px', fontSize: '11px' }}>
          {helpText}
        </small>
      )}
      
      {hasError && (
        <div className="field-error-message">
          {error}
        </div>
      )}
    </div>
  );
}
