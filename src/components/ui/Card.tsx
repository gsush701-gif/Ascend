import { cn } from "../../lib/cn";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-zinc-800/60 bg-zinc-950/60 p-6 shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
