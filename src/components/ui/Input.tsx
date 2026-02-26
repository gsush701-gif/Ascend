import { forwardRef } from "react";
import { cn } from "../../lib/cn";
import { input } from "../../lib/ui";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
  error?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          input,
          error &&
            "border-red-400/50 bg-red-500/5 focus:border-red-400/50 focus:ring-red-400/20",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
