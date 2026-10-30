import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CrtControls } from './CrtControls';
import { DEFAULT_CRT_OVERRIDES } from '../crt/params';

function renderControls(onChange = vi.fn(), onReset = vi.fn()) {
  render(<CrtControls values={DEFAULT_CRT_OVERRIDES} onChange={onChange} onReset={onReset} />);
  return { onChange, onReset };
}

describe('CrtControls', () => {
  it('renders the five reference controls', () => {
    renderControls();
    expect((screen.getByRole('slider', { name: 'Scanlines' }) as HTMLInputElement).value).toBe(
      '100',
    );
    expect(
      (screen.getByRole('slider', { name: 'Horizontal blur' }) as HTMLInputElement).value,
    ).toBe('30');
    expect(
      (screen.getByRole('slider', { name: 'Vertical blur' }) as HTMLInputElement).value,
    ).toBe('15');
    expect((screen.getByRole('slider', { name: 'Vignette' }) as HTMLInputElement).value).toBe(
      '40',
    );
    expect((screen.getByRole('slider', { name: 'Ghosting' }) as HTMLInputElement).value).toBe(
      '30',
    );
  });

  it('commits horizontal and vertical blur independently', () => {
    const { onChange } = renderControls();
    const horizontal = screen.getByRole('slider', { name: 'Horizontal blur' });
    const vertical = screen.getByRole('slider', { name: 'Vertical blur' });

    fireEvent.input(horizontal, { target: { value: '25' } });
    fireEvent.pointerUp(horizontal);
    expect(onChange).toHaveBeenCalledWith({ hBlur: 0.25 });

    fireEvent.input(vertical, { target: { value: '80' } });
    fireEvent.pointerUp(vertical);
    expect(onChange).toHaveBeenCalledWith({ vBlur: 0.8 });
  });

  it('reports reset', () => {
    const { onReset } = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
