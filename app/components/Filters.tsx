'use client';

// Minimum liquidity / volume / safety-score filter controls.

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
        <span className="text-xs font-medium text-slate-200">{label}</span>
        <span className="text-xs tabular-nums text-slate-400">{hint}</span>
      </span>
      {children}
    </label>
  );
}

export default function Filters({ value, onChange }: Props) {
  return (
    <div className="glass glass-sheen grid grid-cols-1 gap-4 rounded-2xl p-4 sm:grid-cols-3">
      <Field
        label="Min. Liquidity"
        hint={`$${value.minLiquidity.toLocaleString('en-US')}`}
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
          className="accent-emerald-400"
        />
      </Field>

      <Field
        label="Min. 24h Volume"
        hint={`$${value.minVolume.toLocaleString('en-US')}`}
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
          className="accent-emerald-400"
        />
      </Field>

      <Field label="Min. Safety Score" hint={`${value.minSafety}`}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value.minSafety}
          onChange={(e) =>
            onChange({ ...value, minSafety: Number(e.target.value) })
          }
          className="accent-emerald-400"
        />
      </Field>
    </div>
  );
}
