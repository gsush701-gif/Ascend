import { cn } from "../../lib/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-semibold transition-colors rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-zinc-100 text-zinc-900 hover:bg-white border border-zinc-200",
    secondary: "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700",
    ghost: "bg-transparent text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-600",
    danger: "bg-red-500/20 text-red-200 hover:bg-red-500/30 border border-red-500/40",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
