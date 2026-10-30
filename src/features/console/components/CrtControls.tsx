import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import type { CrtOverrides } from '../crt/params';

interface CrtControlsProps {
  values: CrtOverrides;
  onChange: (patch: Partial<CrtOverrides>) => void;
  onReset: () => void;
}

const CONTROLS: { key: keyof CrtOverrides; label: string }[] = [
  { key: 'scanlineStrength', label: 'Scanlines' },
  { key: 'softness', label: 'Softness' },
  { key: 'vignette', label: 'Vignette' },
  { key: 'ghosting', label: 'Ghosting' },
];

export function CrtControls({ values, onChange, onReset }: CrtControlsProps) {
  const [draft, setDraft] = useState<CrtOverrides>(values);
  const [previousValues, setPreviousValues] = useState<CrtOverrides>(values);

  // Keep the local slider draft in step with an external change (reset or a
  // settings update) without an effect: guarded derived state.
  if (values !== previousValues) {
    setPreviousValues(values);
    setDraft(values);
  }

  return (
    <div role="group" aria-label="CRT settings" className="flex flex-col gap-2">
      {CONTROLS.map(({ key, label }) => {
        const percent = Math.round(draft[key] * 100);
        const commit = (event: SyntheticEvent<HTMLInputElement>) => {
          const value = Number(event.currentTarget.value) / 100;
          setDraft((current) => ({ ...current, [key]: value }));
          onChange({ [key]: value });
        };
        return (
          <label
            key={key}
            className="flex items-center gap-3 text-body-md text-on-surface-variant"
          >
            <span className="w-20 shrink-0">{label}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={percent}
              aria-label={label}
              aria-valuetext={`${percent}%`}
              onChange={(event) => {
                const value = Number(event.target.value) / 100;
                setDraft((current) => ({ ...current, [key]: value }));
              }}
              onPointerUp={commit}
              onKeyUp={commit}
              onBlur={commit}
              className="h-1.5 w-24 accent-[var(--color-primary)]"
            />
            <span className="w-9 text-right text-label-caps tabular-nums">{percent}%</span>
          </label>
        );
      })}
      <button
        type="button"
        onClick={onReset}
        className="mt-1 self-start rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-body-md text-on-surface-variant transition hover:border-white/20 hover:text-on-surface"
      >
        Reset to reference
      </button>
    </div>
  );
}
