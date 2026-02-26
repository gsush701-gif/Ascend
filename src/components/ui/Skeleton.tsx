import { cn } from "../../lib/cn";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("animate-pulse rounded-lg bg-white/10", className)}
    />
  );
}
