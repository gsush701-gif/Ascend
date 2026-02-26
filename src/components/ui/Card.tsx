import { cn } from "../../lib/cn";
import { card, cardAlt, cardHeader, cardCompact } from "../../lib/ui";

type CardProps = {
  children: React.ReactNode;
  className?: string;
  /** Use translucent bg (bg-white/5) instead of solid dash-card */
  variant?: "default" | "alt";
  compact?: boolean;
};

export function Card({
  children,
  className,
  variant = "default",
  compact = false,
}: CardProps) {
  return (
    <div
      className={cn(
        variant === "alt" ? cardAlt : card,
        compact && cardCompact,
        className
      )}
    >
      {children}
    </div>
  );
}

type CardHeaderProps = {
  children: React.ReactNode;
  className?: string;
};

export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={cn(cardHeader, className)}>{children}</div>;
}

type CardContentProps = {
  children: React.ReactNode;
  className?: string;
};

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn("mt-3", className)}>{children}</div>;
}
