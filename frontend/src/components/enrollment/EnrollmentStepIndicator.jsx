import React from 'react';

export default function EnrollmentStepIndicator({ activeStep, hasEnrolledStudent, onStepChange }) {
  const stepStyle = (active) => ({
    flex: 1,
    padding: '12px 16px',
    background: active ? 'var(--bg-secondary)' : 'var(--bg-primary)',
    border: active ? '2px solid var(--accent)' : '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    transition: 'all 0.15s ease',
  });

  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
      <button type="button" onClick={() => onStepChange(1)} style={stepStyle(activeStep === 1)}>
        <StepNumber active={activeStep === 1}>1</StepNumber>
        <div><div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>Step 1: Student Information</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Personal profile, dynamic address &amp; contact details</div></div>
      </button>
      <button type="button" onClick={() => hasEnrolledStudent && onStepChange(2)} disabled={!hasEnrolledStudent} style={{ ...stepStyle(activeStep === 2), cursor: hasEnrolledStudent ? 'pointer' : 'not-allowed', opacity: hasEnrolledStudent ? 1 : 0.65 }}>
        <StepNumber active={activeStep === 2}>2</StepNumber>
        <div><div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>Step 2: Facial Biometric Enrollment</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{hasEnrolledStudent ? 'Live camera capture ready' : 'Save profile first to unlock'}</div></div>
      </button>
    </div>
  );
}

function StepNumber({ active, children }) {
  return <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: active ? 'var(--accent)' : 'var(--border)', color: active ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}>{children}</div>;
}
