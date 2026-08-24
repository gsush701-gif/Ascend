import { card } from "../../lib/ui";

type PanelProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
};

export function Panel({ title, subtitle, right, children }: PanelProps) {
  return (
    <section className={card}>
      {(title ?? subtitle ?? right) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title != null && (
              <div className="text-sm font-semibold text-slate-900">{title}</div>
            )}
            {subtitle != null && (
              <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
            )}
          </div>
          {right}
        </div>
      )}
      {children != null ? children : null}
    </section>
  );
}
