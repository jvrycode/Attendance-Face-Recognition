import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StudentEnrollmentView from '../views/StudentEnrollmentView';
import { Api } from '../api';

vi.mock('../api', () => ({
  Api: {
    getPrograms: vi.fn(),
    getCourses: vi.fn(),
    getSections: vi.fn(),
    getNextStudentId: vi.fn(),
    createUser: vi.fn(),
    enrollStudent: vi.fn(),
    enrollFace: vi.fn(),
    enrollFaceWithConfirm: vi.fn(),
  },
}));
vi.mock('../utils/phLocationsApi', () => ({
  getRegions: vi.fn().mockResolvedValue([]),
  getProvinces: vi.fn().mockResolvedValue([]),
  getCitiesMunicipalities: vi.fn().mockResolvedValue([]),
}));
vi.mock('../components/enrollment/EnrollmentStepIndicator', () => ({ default: () => <div data-testid="step-indicator" /> }));
vi.mock('../components/enrollment/BiometricEnrollmentStep', () => ({ default: () => <div data-testid="biometric-step" /> }));
vi.mock('../components/enrollment/StudentEnrollmentForm', () => ({ default: ({ formData, setFormData, onSubmit, onSaveOnly }) => (
  <form data-testid="student-form" onSubmit={(event) => onSubmit(event, true)}>
    <input aria-label="student id" value={formData.student_id} readOnly />
    <input aria-label="family name" value={formData.family_name} onChange={(event) => setFormData((previous) => ({ ...previous, family_name: event.target.value }))} />
    <input aria-label="given name" value={formData.given_name} onChange={(event) => setFormData((previous) => ({ ...previous, given_name: event.target.value }))} />
    <input aria-label="mobile number" value={formData.mobile_number} onChange={(event) => setFormData((previous) => ({ ...previous, mobile_number: event.target.value }))} />
    <input aria-label="password" value={formData.password} onChange={(event) => setFormData((previous) => ({ ...previous, password: event.target.value }))} />
    <select aria-label="section" value={formData.section_id} onChange={(event) => setFormData((previous) => ({ ...previous, section_id: event.target.value }))}>
      <option value="">No section</option><option value="9">IT-1A</option>
    </select>
    <output aria-label="academic selection">{[formData.program, formData.course, formData.year_level].join('|')}</output>
    <button type="button" onClick={() => setFormData((previous) => ({ ...previous, program_id: 1, program: 'CITEC', course_ref: 4, course: 'BSIT', year_level: 1 }))}>Pick academic</button>
    <button type="button" onClick={(event) => onSaveOnly(event)}>Save Profile Only</button>
    <button type="submit">Save &amp; Proceed</button>
  </form>
) }));

describe('student enrollment feature workflow', () => {
  it('builds the current student payload and enrolls into the selected section', async () => {
    Api.getPrograms.mockResolvedValue([{ id: 1, code: 'CITEC', name: 'Technology' }]);
    Api.getCourses.mockResolvedValue([{ id: 4, program: 1, code: 'BSIT', name: 'Information Technology' }]);
    Api.getSections.mockResolvedValue([{ id: 9, course_ref: 4, name: 'IT-1A' }]);
    Api.getNextStudentId.mockResolvedValue({ next_student_id: 'STU-100' });
    Api.createUser.mockResolvedValue({ student_profile: { id: 22 }, username: 'stu100' });
    Api.enrollStudent.mockResolvedValue({ id: 30 });

    render(<StudentEnrollmentView onNavigate={vi.fn()} onSetHeaderInfo={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('student id')).toHaveValue('STU-100'));
    fireEvent.change(screen.getByLabelText('family name'), { target: { value: 'Lovelace' } });
    fireEvent.change(screen.getByLabelText('given name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('mobile number'), { target: { value: '09171234567' } });
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'StrongPassword123!' } });
    fireEvent.click(screen.getByText('Pick academic'));
    fireEvent.change(screen.getByLabelText('section'), { target: { value: '9' } });
    fireEvent.submit(screen.getByTestId('student-form'));

    await waitFor(() => expect(Api.createUser).toHaveBeenCalledOnce());
    expect(Api.createUser.mock.calls[0][0]).toMatchObject({
      role: 'student',
      student_id: 'STU-100',
      first_name: 'Ada',
      last_name: 'Lovelace',
      course_ref: 4,
      mobile_number: '09171234567',
    });
    expect(Api.enrollStudent).toHaveBeenCalledWith('9', 22);
  });

  it('rejects submission when family or given name is missing', async () => {
    Api.getPrograms.mockResolvedValue([]);
    Api.getCourses.mockResolvedValue([]);
    Api.getSections.mockResolvedValue([]);
    Api.getNextStudentId.mockResolvedValue({ next_student_id: 'STU-101' });

    render(<StudentEnrollmentView onNavigate={vi.fn()} onSetHeaderInfo={vi.fn()} />);
    fireEvent.submit(screen.getByTestId('student-form'));

    expect(await screen.findByText(/Please enter both Family Name/)).toBeInTheDocument();
    expect(Api.createUser).not.toHaveBeenCalled();
  });

  it('starts with no program, course, or year level pre-selected', async () => {
    sessionStorage.clear();
    Api.createUser.mockClear();
    Api.getPrograms.mockResolvedValue([{ id: 1, code: 'CITEC', name: 'Technology' }]);
    Api.getCourses.mockResolvedValue([{ id: 4, program: 1, code: 'BSIT', name: 'Information Technology' }]);
    Api.getSections.mockResolvedValue([]);
    Api.getNextStudentId.mockResolvedValue({ next_student_id: 'STU-102' });

    render(<StudentEnrollmentView onNavigate={vi.fn()} onSetHeaderInfo={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText('student id')).toHaveValue('STU-102'));
    expect(screen.getByLabelText('academic selection')).toHaveTextContent(/^\|\|$/);

    fireEvent.change(screen.getByLabelText('family name'), { target: { value: 'Lovelace' } });
    fireEvent.change(screen.getByLabelText('given name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('password'), { target: { value: 'StrongPassword123!' } });
    fireEvent.submit(screen.getByTestId('student-form'));

    expect(await screen.findByText(/select the Academic Program, Degree Course, and Year Level/)).toBeInTheDocument();
    expect(Api.createUser).not.toHaveBeenCalled();
  });
});
