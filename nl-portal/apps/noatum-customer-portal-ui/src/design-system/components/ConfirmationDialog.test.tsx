import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ConfirmationDialog } from './ConfirmationDialog';

afterEach(cleanup);

describe('ConfirmationDialog', () => {
  it('renders accessible title and description and confirms', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmationDialog
        open
        onOpenChange={() => undefined}
        title="Request sent"
        description="Reference Q-2026-0194 was sent to Noatum Valencia."
        confirmLabel="View request"
        cancelLabel="Close"
        closeLabel="Close dialog"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Request sent' })).toHaveTextContent(
      'Reference Q-2026-0194',
    );
    await user.click(screen.getByRole('button', { name: 'View request' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('blocks confirmation while pending', () => {
    render(
      <ConfirmationDialog
        open
        onOpenChange={() => undefined}
        title="Publishing"
        description="The quotation is being published."
        confirmLabel="Publish"
        cancelLabel="Cancel"
        closeLabel="Close dialog"
        pending
        onConfirm={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  });
});
