import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReopenSessionModal from '../components/scanner/ReopenSessionModal';

describe('reopen attendance modal', () => {
  it('requires a reason and submits it to the audited reopen callback', () => {
    const onConfirm = vi.fn();
    render(<ReopenSessionModal session={{ schedule_details: { section_name: 'IT-1A', subject_code: 'IT101' } }} isOpen loading={false} error="" onClose={vi.fn()} onConfirm={onConfirm} />);

    const submit = screen.getByRole('button', { name: 'Reopen session' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Reason for reopening/i), { target: { value: 'Late-arriving students' } });
    fireEvent.click(submit);
    expect(onConfirm).toHaveBeenCalledWith('Late-arriving students');
  });
});
