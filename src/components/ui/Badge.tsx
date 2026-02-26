import { cn } from "../../lib/cn";
import { badge, badgePrimary } from "../../lib/ui";

type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "primary";
  className?: string;
};

export function Badge({
  children,
  variant = "default",
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(variant === "primary" ? badgePrimary : badge, className)}
    >
      {children}
    </span>
  );
}
