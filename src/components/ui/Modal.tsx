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
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-xl border border-white/10 bg-[#0d1117] p-6 shadow-xl">
        <h2
          id="modal-title"
          className="text-lg font-semibold text-white"
        >
          {title}
        </h2>
        <div className="mt-4 text-sm text-white/80">{children}</div>
        <button
          type="button"
          onClick={onClose}
          className="btn-press mt-6 w-full rounded-lg border border-white/20 bg-white/5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
