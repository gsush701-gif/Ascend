type ScoreRingProps = { value: number };

export function ScoreRing({ value }: ScoreRingProps) {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;

  const label =
    pct >= 80 ? "Strong fit" : pct >= 60 ? "Good fit" : pct >= 40 ? "Medium" : "Low";

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <svg width={size} height={size} className="block">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            className="stroke-zinc-800"
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            className="stroke-zinc-200"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-2xl font-semibold tracking-tight">{pct}%</div>
            <div className="text-xs text-zinc-400">Alignment</div>
          </div>
        </div>
      </div>
      <div>
        <div className="text-xs text-zinc-500">Summary</div>
        <div className="text-xl font-semibold">{label}</div>
        <div className="mt-1 text-sm text-zinc-400">
          Fix the first 2–3 misses to move fast.
        </div>
      </div>
    </div>
  );
}
