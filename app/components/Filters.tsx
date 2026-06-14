'use client';

// Minimum likidite / hacim / güvenlik skoru filtre kontrolleri.

export interface FilterState {
  minLiquidity: number;
  minVolume: number;
  minSafety: number;
}

interface Props {
  value: FilterState;
  onChange: (next: FilterState) => void;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className="text-xs tabular-nums text-slate-500">{hint}</span>
      </span>
      {children}
    </label>
  );
}

export default function Filters({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3">
      <Field
        label="Min. Likidite"
        hint={`$${value.minLiquidity.toLocaleString('tr-TR')}`}
      >
        <input
          type="range"
          min={0}
          max={500000}
          step={1000}
          value={value.minLiquidity}
          onChange={(e) =>
            onChange({ ...value, minLiquidity: Number(e.target.value) })
          }
          className="accent-emerald-500"
        />
      </Field>

      <Field
        label="Min. 24s Hacim"
        hint={`$${value.minVolume.toLocaleString('tr-TR')}`}
      >
        <input
          type="range"
          min={0}
          max={1000000}
          step={5000}
          value={value.minVolume}
          onChange={(e) =>
            onChange({ ...value, minVolume: Number(e.target.value) })
          }
          className="accent-emerald-500"
        />
      </Field>

      <Field label="Min. Güvenlik Skoru" hint={`${value.minSafety}`}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value.minSafety}
          onChange={(e) =>
            onChange({ ...value, minSafety: Number(e.target.value) })
          }
          className="accent-emerald-500"
        />
      </Field>
    </div>
  );
}
