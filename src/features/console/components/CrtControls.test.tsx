import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrtControls } from './CrtControls';
import { DEFAULT_CRT_OVERRIDES } from '../crt/params';

function renderControls(onChange = vi.fn(), onReset = vi.fn()) {
  render(<CrtControls values={DEFAULT_CRT_OVERRIDES} onChange={onChange} onReset={onReset} />);
  return { onChange, onReset };
}

describe('CrtControls', () => {
  it('renders the four reference controls', () => {
    renderControls();
    expect((screen.getByRole('slider', { name: 'Scanlines' }) as HTMLInputElement).value).toBe(
      '100',
    );
    expect((screen.getByRole('slider', { name: 'Softness' }) as HTMLInputElement).value).toBe(
      '50',
    );
    expect((screen.getByRole('slider', { name: 'Vignette' }) as HTMLInputElement).value).toBe(
      '35',
    );
    expect((screen.getByRole('slider', { name: 'Ghosting' }) as HTMLInputElement).value).toBe(
      '30',
    );
  });

  it('commits a slider change on release', () => {
    const { onChange } = renderControls();
    const slider = screen.getByRole('slider', { name: 'Softness' });

    fireEvent.input(slider, { target: { value: '25' } });
    fireEvent.pointerUp(slider);

    expect(onChange).toHaveBeenCalledWith({ softness: 0.25 });
  });

  it('reports reset', () => {
    const { onReset } = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to reference' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
