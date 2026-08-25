import { useEffect } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-modal-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-[#FFFFFF] p-6 shadow-xl animate-modal-content">
        <h2
          id="modal-title"
          className="text-lg font-semibold text-slate-900"
        >
          {title}
        </h2>
        <div className="mt-4 text-sm text-slate-700">{children}</div>
        <button
          type="button"
          onClick={onClose}
          className="btn-press mt-6 w-full rounded-lg border border-slate-300 bg-slate-900/[0.04] py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-900/[0.06]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
