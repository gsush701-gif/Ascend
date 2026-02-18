import { cn } from "../../lib/cn";

type ContainerProps = {
  children: React.ReactNode;
  className?: string;
};

export function Container({ children, className }: ContainerProps) {
  return (
    <div className={cn("mx-auto max-w-7xl px-6 py-8", className)}>
      {children}
    </div>
  );
}
