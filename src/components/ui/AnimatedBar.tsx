import { useEffect, useState } from "react";

type AnimatedBarProps = {
  pct: number;
  colorClassName?: string;
  gradient?: string;
  trackClassName?: string;
  height?: string;
  delayMs?: number;
};

/** Horizontal progress bar that grows from 0 on mount instead of snapping to its final width. */
export function AnimatedBar({
  pct,
  colorClassName,
  gradient,
  trackClassName = "bg-dash-surface",
  height = "h-2",
  delayMs = 0,
}: AnimatedBarProps) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(
      () => setWidth(pct > 0 ? Math.max(pct, 2) : 0),
      60 + delayMs,
    );
    return () => clearTimeout(t);
  }, [pct, delayMs]);

  return (
    <div className={`${height} rounded-full ${trackClassName}`}>
      <div
        className={`${height} rounded-full transition-all duration-700 ease-out ${colorClassName ?? ""}`}
        style={{ width: `${width}%`, ...(gradient ? { background: gradient } : {}) }}
      />
    </div>
  );
}
