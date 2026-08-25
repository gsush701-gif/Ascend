import { card } from "../../lib/ui";
import { Button } from "./Button";

type EmptyStateProps = {
  title: string;
  subtitle: string;
  bullets?: string[];
  primaryAction: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  tertiaryAction?: { label: string; onClick: () => void };
  compact?: boolean;
};

export function EmptyState({
  title,
  subtitle,
  bullets = [],
  primaryAction,
  secondaryAction,
  tertiaryAction,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`animate-fade-in flex flex-col items-center justify-center px-6 text-center ${card} ${
        compact ? "py-8" : "py-12"
      }`}
    >
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p
        className={`mt-1.5 text-slate-500 ${
          compact ? "text-sm" : "text-sm max-w-md"
        }`}
      >
        {subtitle}
      </p>
      {bullets.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-left text-sm text-slate-600">
          {bullets.slice(0, 3).map((b, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-cyan-600">•</span>
              {b}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" onClick={primaryAction.onClick}>
          {primaryAction.label}
        </Button>
        {secondaryAction && (
          <Button variant="secondary" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
        {tertiaryAction && (
          <Button variant="ghost" onClick={tertiaryAction.onClick}>
            {tertiaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}
