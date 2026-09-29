/**
 * Form Validation Utilities
 * Provides client-side validation with automatic scroll-to-error and focus management
 */

/**
 * Validates form fields and automatically scrolls to + focuses first invalid field
 * @param {Object} formData - Form data object with field values
 * @param {Object} rules - Validation rules object { fieldName: { required, minLength, maxLength, pattern, custom } }
 * @param {HTMLFormElement} formRef - Reference to the form element (optional, for auto-scroll)
 * @returns {Object} { isValid: boolean, errors: { fieldName: errorMessage } }
 */
export function validateForm(formData, rules, formRef = null) {
  const errors = {};
  let firstInvalidField = null;

  // Validate each field according to rules
  for (const [fieldName, fieldRules] of Object.entries(rules)) {
    const value = formData[fieldName];
    const error = validateField(fieldName, value, fieldRules, formData);
    
    if (error) {
      errors[fieldName] = error;
      if (!firstInvalidField) {
        firstInvalidField = fieldName;
      }
    }
  }

  const isValid = Object.keys(errors).length === 0;

  // Auto-scroll and focus first invalid field
  if (!isValid && firstInvalidField && formRef) {
    scrollToAndFocusField(firstInvalidField, formRef);
  }

  return { isValid, errors };
}

/**
 * Validates a single field
 * @param {String} fieldName - Field name
 * @param {*} value - Field value
 * @param {Object} rules - Validation rules
 * @param {Object} formData - Full form data (for custom validators)
 * @returns {String|null} Error message or null if valid
 */
export function validateField(fieldName, value, rules, formData = {}) {
  // Required validation
  if (rules.required && isEmpty(value)) {
    return rules.requiredMessage || `${formatFieldLabel(fieldName)} is required.`;
  }

  // Skip other validations if value is empty and not required
  if (isEmpty(value) && !rules.required) {
    return null;
  }

  // MinLength validation
  if (rules.minLength && String(value).length < rules.minLength) {
    return rules.minLengthMessage || `${formatFieldLabel(fieldName)} must be at least ${rules.minLength} characters.`;
  }

  // MaxLength validation
  if (rules.maxLength && String(value).length > rules.maxLength) {
    return rules.maxLengthMessage || `${formatFieldLabel(fieldName)} must be at most ${rules.maxLength} characters.`;
  }

  // Min value validation (for numbers)
  if (rules.min !== undefined && Number(value) < rules.min) {
    return rules.minMessage || `${formatFieldLabel(fieldName)} must be at least ${rules.min}.`;
  }

  // Max value validation (for numbers)
  if (rules.max !== undefined && Number(value) > rules.max) {
    return rules.maxMessage || `${formatFieldLabel(fieldName)} must be at most ${rules.max}.`;
  }

  // Email validation
  if (rules.email && !isValidEmail(value)) {
    return rules.emailMessage || 'Please enter a valid email address (e.g., user@example.com).';
  }

  // Phone validation (Philippine mobile format)
  if (rules.phone && !isValidPhoneNumber(value)) {
    return rules.phoneMessage || 'Please enter a valid 11-digit mobile number starting with 09 (e.g., 09123456789).';
  }

  // Pattern validation (regex)
  if (rules.pattern && !rules.pattern.test(String(value))) {
    return rules.patternMessage || `${formatFieldLabel(fieldName)} format is invalid.`;
  }

  // Match validation (e.g., password confirmation)
  if (rules.match) {
    const matchField = rules.match;
    if (value !== formData[matchField]) {
      return rules.matchMessage || `${formatFieldLabel(fieldName)} must match ${formatFieldLabel(matchField)}.`;
    }
  }

  // Custom validation function
  if (rules.custom) {
    const customError = rules.custom(value, formData);
    if (customError) {
      return customError;
    }
  }

  return null;
}

/**
 * Scrolls to and focuses the first invalid field
 * @param {String} fieldName - Field name to scroll to
 * @param {HTMLFormElement} formRef - Form element reference
 */
export function scrollToAndFocusField(fieldName, formRef) {
  if (!formRef) return;

  // Try different selectors to find the field
  const selectors = [
    `[name="${fieldName}"]`,
    `#${fieldName}`,
    `[data-field="${fieldName}"]`,
    `.field-${fieldName}`,
  ];

  let field = null;
  for (const selector of selectors) {
    field = formRef.querySelector(selector);
    if (field) break;
  }

  if (!field) {
    // Fallback: try to find by label text
    const labels = formRef.querySelectorAll('label');
    for (const label of labels) {
      if (label.textContent.toLowerCase().includes(fieldName.toLowerCase())) {
        const labelFor = label.getAttribute('for');
        if (labelFor) {
          field = formRef.querySelector(`#${labelFor}`);
          if (field) break;
        }
      }
    }
  }

  if (field) {
    // Scroll to field with smooth behavior and offset for header
    const offset = 100; // Offset for fixed headers
    const elementPosition = field.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = elementPosition - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });

    // Focus the field after scroll animation
    setTimeout(() => {
      field.focus();
      
      // Add visual highlight
      field.classList.add('field-error-highlight');
      setTimeout(() => {
        field.classList.remove('field-error-highlight');
      }, 2000);
    }, 300);
  }
}

/**
 * Check if value is empty
 * @param {*} value - Value to check
 * @returns {Boolean}
 */
function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Validates email format
 * @param {String} email - Email to validate
 * @returns {Boolean}
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).toLowerCase());
}

/**
 * Validates Philippine mobile number (09XXXXXXXXX)
 * @param {String} phone - Phone number to validate
 * @returns {Boolean}
 */
function isValidPhoneNumber(phone) {
  const cleaned = String(phone).replace(/\D/g, '');
  return /^09\d{9}$/.test(cleaned);
}

/**
 * Format field name for display
 * @param {String} fieldName - Field name in camelCase or snake_case
 * @returns {String} Formatted label
 */
function formatFieldLabel(fieldName) {
  const labelMap = {
    firstName: 'First Name',
    lastName: 'Last Name',
    middleName: 'Middle Name',
    email: 'Email',
    phone: 'Phone Number',
    mobileNumber: 'Mobile Number',
    studentId: 'Student ID',
    employeeId: 'Faculty ID',
    birthDate: 'Date of Birth',
    birthPlace: 'Place of Birth',
    civilStatus: 'Civil Status',
    currentAddress: 'Current Address',
    yearLevel: 'Year Level',
    courseRef: 'Course',
    programId: 'Academic Program',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    oldPassword: 'Current Password',
    newPassword: 'New Password',
  };

  if (labelMap[fieldName]) {
    return labelMap[fieldName];
  }

  // Convert camelCase or snake_case to Title Case
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Common validation rule presets
 */
export const ValidationRules = {
  required: (message) => ({ required: true, requiredMessage: message }),
  
  email: (message) => ({ 
    required: true, 
    email: true, 
    requiredMessage: message || 'Email is required.',
    emailMessage: 'Please enter a valid email address.'
  }),
  
  phone: (message) => ({
    required: true,
    phone: true,
    requiredMessage: message || 'Phone number is required.',
    phoneMessage: 'Please enter a valid 11-digit mobile number starting with 09.'
  }),
  
  password: (minLength = 8) => ({
    required: true,
    minLength,
    requiredMessage: 'Password is required.',
    minLengthMessage: `Password must be at least ${minLength} characters.`,
  }),
  
  confirmPassword: (passwordField = 'password') => ({
    required: true,
    match: passwordField,
    requiredMessage: 'Please confirm your password.',
    matchMessage: 'Passwords do not match.',
  }),
  
  studentId: () => ({
    required: true,
    minLength: 5,
    requiredMessage: 'Student ID is required.',
    minLengthMessage: 'Student ID must be at least 5 characters.',
  }),
  
  name: (fieldLabel) => ({
    required: true,
    minLength: 2,
    maxLength: 150,
    requiredMessage: `${fieldLabel} is required.`,
    minLengthMessage: `${fieldLabel} must be at least 2 characters.`,
    maxLengthMessage: `${fieldLabel} must not exceed 150 characters.`,
  }),
  
  select: (fieldLabel) => ({
    required: true,
    requiredMessage: `Please select a ${fieldLabel}.`,
  }),
};

/**
 * React Hook for form validation
 * @param {Object} initialData - Initial form data
 * @param {Object} validationRules - Validation rules
 * @returns {Object} { formData, errors, handleChange, handleSubmit, setFormData, setErrors, clearErrors }
 */
export function useFormValidation(initialData = {}, validationRules = {}) {
  const [formData, setFormData] = React.useState(initialData);
  const [errors, setErrors] = React.useState({});
  const formRef = React.useRef(null);

  const handleChange = (fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    
    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const handleSubmit = (onSubmit) => (e) => {
    e.preventDefault();
    
    const { isValid, errors: validationErrors } = validateForm(
      formData, 
      validationRules, 
      formRef.current || e.target
    );
    
    setErrors(validationErrors);
    
    if (isValid && onSubmit) {
      onSubmit(formData);
    }
  };

  const clearErrors = () => setErrors({});

  return {
    formData,
    errors,
    handleChange,
    handleSubmit,
    setFormData,
    setErrors,
    clearErrors,
    formRef,
  };
}

// Note: React import above is just for documentation
// In actual usage, import React in the component file
