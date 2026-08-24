import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

type TooltipProps = {
  content: string;
  children: React.ReactNode;
  disabled?: boolean;
};

export function Tooltip({ content, children, disabled = false }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: rect.left + rect.width / 2,
    });
  }, []);

  useEffect(() => {
    if (!visible) return;
    updatePosition();
    const handleScroll = () => updatePosition();
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [visible, updatePosition]);

  if (disabled || !content.trim()) {
    return <>{children}</>;
  }

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-block cursor-default"
        onMouseEnter={() => {
          setVisible(true);
          updatePosition();
        }}
        onMouseLeave={() => setVisible(false)}
      >
        {children}
      </span>
      {visible &&
        createPortal(
          <div
            className="fixed z-[100] -translate-x-1/2 rounded-lg border border-slate-200 bg-[#FFFFFF] px-2.5 py-1.5 text-xs text-slate-800 shadow-lg"
            style={{ top: position.top, left: position.left }}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}
