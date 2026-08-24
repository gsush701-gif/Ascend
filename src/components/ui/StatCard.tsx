type StatCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
};

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="card-hover-lift rounded-3xl border border-slate-200 bg-slate-900/[0.04] p-6 backdrop-blur-xl transition hover:bg-white/[0.07]">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      {hint != null && (
        <div className="mt-2 text-xs text-slate-500">{hint}</div>
      )}
    </div>
  );
}
