import { forwardRef } from "react";
import { cn } from "../../lib/cn";
import { textarea } from "../../lib/ui";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  className?: string;
  error?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          textarea,
          error &&
            "border-red-400/50 bg-red-500/5 focus:border-red-400/50 focus:ring-red-400/20",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
