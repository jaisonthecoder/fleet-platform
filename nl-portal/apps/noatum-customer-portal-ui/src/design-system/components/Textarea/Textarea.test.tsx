import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Textarea } from './Textarea';

describe('Textarea', () => {
  it('ties the label to the control, so clicking the label focuses it', () => {
    render(<Textarea label="Included" defaultValue="Ocean freight" />);
    expect(screen.getByLabelText('Included')).toHaveValue('Ocean freight');
  });

  it('keeps the label for assistive technology when it is visually hidden', () => {
    render(<Textarea label="Excluded" labelHidden />);
    expect(screen.getByLabelText('Excluded')).toBeInTheDocument();
  });

  it('marks the field invalid and announces the message', () => {
    render(<Textarea label="Included" error="Say what the price covers" />);
    const control = screen.getByLabelText('Included');
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Say what the price covers');
  });

  it('describes the field by its hint, and drops the hint once there is an error', () => {
    const { rerender } = render(<Textarea label="Notes" hint="Shown with this option" />);
    expect(screen.getByLabelText('Notes')).toHaveAccessibleDescription('Shown with this option');

    rerender(<Textarea label="Notes" hint="Shown with this option" error="Too long" />);
    expect(screen.getByLabelText('Notes')).toHaveAccessibleDescription('Too long');
  });
});
