import { cn } from "../../lib/cn";
import { sectionTitle } from "../../lib/ui";

type SectionTitleProps = {
  children: React.ReactNode;
  className?: string;
};

export function SectionTitle({ children, className }: SectionTitleProps) {
  return (
    <h2 className={cn(sectionTitle, className)}>
      {children}
    </h2>
  );
}
