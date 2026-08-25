import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

type Option = { value: string; label: string };

type DarkSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  buttonClassName?: string;
  placeholder?: string;
};

export function DarkSelect({
  value,
  onChange,
  options,
  buttonClassName = "",
  placeholder = "Select…",
}: DarkSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        ref.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      )
        return;
      setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? placeholder;

  const [dropdownStyle, setDropdownStyle] = useState({ top: 0, left: 0 });

  const updatePosition = useRef(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setDropdownStyle({ top: rect.bottom + 4, left: rect.left });
  }).current;

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleScroll = () => updatePosition();
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [open, updatePosition]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center justify-between gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-[#F4F5FA] ${buttonClassName}`}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={(el) => {
              dropdownRef.current = el;
            }}
            className="fixed z-[200] min-w-[140px] overflow-hidden rounded-lg border border-slate-200 bg-[#FFFFFF] shadow-lg animate-fade-in"
            role="listbox"
            style={{ top: dropdownStyle.top, left: dropdownStyle.left }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-sm transition ${
                  opt.value === value
                    ? "bg-slate-900/[0.06] text-slate-900"
                    : "text-slate-700 hover:bg-slate-900/[0.06] hover:text-slate-900"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
