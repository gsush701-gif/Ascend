type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export function SectionHeader({ title, subtitle, right }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-base font-semibold tracking-tight">{title}</div>
        {subtitle ? (
          <div className="mt-1 text-sm text-zinc-400">{subtitle}</div>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}
