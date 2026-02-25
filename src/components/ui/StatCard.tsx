type StatCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
};

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="card-hover-lift rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition hover:bg-white/[0.07]">
      <div className="text-xs text-white/55">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      {hint != null && (
        <div className="mt-2 text-xs text-white/55">{hint}</div>
      )}
    </div>
  );
}
