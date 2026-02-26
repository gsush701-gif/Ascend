import { cn } from "../../lib/cn";
import {
  buttonPrimary,
  buttonSecondary,
  buttonGhost,
  buttonDanger,
  buttonDangerOutline,
} from "../../lib/ui";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "dangerOutline";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
};

const variantClasses = {
  primary: buttonPrimary,
  secondary: buttonSecondary,
  ghost: buttonGhost,
  danger: buttonDanger,
  dangerOutline: buttonDangerOutline,
};

const sizeClasses = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
