export function EmptyChartState() {
  return (
    <div className="flex h-[120px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-900/[0.04]">
      <p className="text-sm font-medium text-slate-600">Not enough history yet</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Add more activity to see trends.
      </p>
    </div>
  );
}
