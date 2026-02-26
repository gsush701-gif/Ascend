export function EmptyChartState() {
  return (
    <div className="flex h-[120px] flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5">
      <p className="text-sm font-medium text-white/70">Not enough history yet</p>
      <p className="mt-0.5 text-xs text-white/50">
        Add more activity to see trends.
      </p>
    </div>
  );
}
