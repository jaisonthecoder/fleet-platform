import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ContainerSelector } from './ContainerSelector';

// Radix Slider observes its track to place the thumb. jsdom ships no
// ResizeObserver, so without this every test that renders the payload block
// dies before it asserts anything.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

afterEach(cleanup);

const base = {
  label: '40 ft high cube',
  code: "40' HC",
  dimensions: '12.03 × 2.35 × 2.69 m',
  countLabel: 'Containers',
  decrementLabel: 'One fewer container',
  incrementLabel: 'One more container',
  payloadLabel: 'Gross each',
  payloadLimit: 28000,
  onCountChange: () => {},
  onPayloadChange: () => {},
};

describe('ContainerSelector (SE-04)', () => {
  it('hides the payload block until a container is chosen', () => {
    const { rerender } = render(<ContainerSelector {...base} count={0} payload={0} />);
    expect(screen.queryByRole('slider')).not.toBeInTheDocument();

    rerender(<ContainerSelector {...base} count={1} payload={0} />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('keeps the payload slider mounted when the count returns to zero', () => {
    // Unmounting it discarded the entered weight and dropped focus to <body>.
    const { rerender } = render(<ContainerSelector {...base} count={2} payload={17100} />);
    expect(screen.getByRole('slider')).toBeInTheDocument();

    rerender(<ContainerSelector {...base} count={0} payload={17100} />);
    const slider = screen.queryByRole('slider');
    expect(slider === null || slider.getAttribute('data-disabled') !== null).toBe(true);
  });

  it('names the slider thumb, which Radix leaves unnamed', () => {
    render(<ContainerSelector {...base} count={1} payload={17100} />);
    expect(screen.getByRole('slider', { name: 'Gross each' })).toBeInTheDocument();
  });

  it('takes the threshold as a prop rather than hard-coding commercial policy', () => {
    const { container, rerender } = render(
      <ContainerSelector {...base} count={1} payload={17100} overLabel="Over the limit" />,
    );
    expect(container.querySelector('[data-over]')).toBeNull();

    // 17,100 is 61% of 28,000 — over a 50% threshold, under the default 95%.
    rerender(
      <ContainerSelector
        {...base}
        count={1}
        payload={17100}
        warnAt={0.5}
        overLabel="Over the limit"
      />,
    );
    expect(container.querySelector('[data-over]')).not.toBeNull();
    expect(screen.getByText('Over the limit')).toBeVisible();
  });

  it('does not rely on colour alone once over the threshold', () => {
    render(
      <ContainerSelector {...base} count={1} payload={27900} overLabel="Over the payload limit" />,
    );
    expect(screen.getByText('Over the payload limit')).toBeVisible();
  });

  it('steps the count within its bounds', async () => {
    const user = userEvent.setup();
    const onCountChange = vi.fn();
    render(
      <ContainerSelector
        {...base}
        count={0}
        payload={0}
        maxCount={2}
        onCountChange={onCountChange}
      />,
    );
    expect(screen.getByRole('button', { name: 'One fewer container' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'One more container' }));
    expect(onCountChange).toHaveBeenCalledWith(1);
  });

  it('stops the count at its maximum', () => {
    render(<ContainerSelector {...base} count={2} payload={0} maxCount={2} />);
    expect(screen.getByRole('button', { name: 'One more container' })).toBeDisabled();
  });

  it('survives a zero payload limit rather than rendering a full meter', () => {
    const { container } = render(<ContainerSelector {...base} count={1} payload={0} payloadLimit={0} />);
    const fill = container.querySelector('[style*="--fill"]');
    expect(fill?.getAttribute('style')).toContain('0%');
  });
});

describe('ContainerSelector · the weight field', () => {
  /** Controlled, the way EquipmentPicker holds it. */
  function Harness({ limit = 28000 }: { limit?: number }) {
    const [payload, setPayload] = useState(0);
    return (
      <ContainerSelector
        {...base}
        count={1}
        payload={payload}
        payloadLimit={limit}
        payloadUnit="kg"
        onPayloadChange={setPayload}
      />
    );
  }

  it('lets the weight be typed, not only dragged', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const field = screen.getByRole('textbox', { name: 'Gross each' });
    await user.type(field, '3000');

    expect(field).toHaveValue('3000');
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '3000');
  });

  it('can be cleared and retyped, which a value echoed straight back cannot', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const field = screen.getByRole('textbox', { name: 'Gross each' });
    await user.type(field, '3000');
    await user.clear(field);

    // Without the draft the prop would come back as 0 and refill the field
    // mid-keystroke, so the only way to correct a weight was to select it first.
    expect(field).toHaveValue('');

    await user.type(field, '4500');
    expect(field).toHaveValue('4500');
  });

  it('takes digits only, so the weight never arrives as "12e4"', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const field = screen.getByRole('textbox', { name: 'Gross each' });
    await user.type(field, '-1.2e4abc500');

    expect(field).toHaveValue('124500');
  });

  it('accepts an over-payload figure and warns rather than refusing it', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness limit={1000} />
      </>,
    );

    const field = screen.getByRole('textbox', { name: 'Gross each' });
    await user.type(field, '1900');

    // The binding limit is on the container's own CSC plate, so the card says
    // so in words and still lets the request describe what is really loading.
    expect(field).toHaveValue('1900');
  });

  it('shows the unit beside the field rather than inside it', () => {
    render(<Harness />);
    // A field holding "17,100 kg" is a field nobody can type into.
    expect(screen.getByRole('textbox', { name: 'Gross each' })).toHaveValue('');
    expect(screen.getByText('kg')).toBeInTheDocument();
  });
});
