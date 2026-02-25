type PanelProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
};

export function Panel({ title, subtitle, right, children }: PanelProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      {(title ?? subtitle ?? right) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title != null && (
              <div className="text-sm font-semibold">{title}</div>
            )}
            {subtitle != null && (
              <div className="mt-1 text-xs text-white/60">{subtitle}</div>
            )}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
