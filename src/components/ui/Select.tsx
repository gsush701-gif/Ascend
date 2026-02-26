import { DarkSelect } from "./DarkSelect";
import { select } from "../../lib/ui";
import { cn } from "../../lib/cn";

type Option = { value: string; label: string };

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  buttonClassName?: string;
};

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  buttonClassName,
}: SelectProps) {
  return (
    <DarkSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      buttonClassName={cn(select, buttonClassName)}
    />
  );
}
