import { useCallback } from "react";
import { toast } from "./toast";
import type { ToastOptions } from "./toast";

/** Hook that returns toast helpers. Use for consistency or when you need memoized callbacks. */
export function useToast() {
  return {
    success: useCallback(
      (options: ToastOptions | string) => {
        const opts = typeof options === "string" ? { title: options } : options;
        toast.success(opts);
      },
      []
    ),
    error: useCallback(
      (options: ToastOptions | string) => {
        const opts = typeof options === "string" ? { title: options } : options;
        toast.error(opts);
      },
      []
    ),
    info: useCallback(
      (options: ToastOptions | string) => {
        const opts = typeof options === "string" ? { title: options } : options;
        toast.info(opts);
      },
      []
    ),
    dismiss: useCallback((id: string) => toast.dismiss(id), []),
  };
}
