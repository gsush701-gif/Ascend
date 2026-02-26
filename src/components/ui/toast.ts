/** Toast API: call toast.success(), toast.error(), toast.info() */

export type ToastType = "success" | "error" | "info";

export type ToastOptions = {
  title: string;
  description?: string;
  /** When set, replaces any existing toast with the same groupId (debounce rapid actions) */
  groupId?: string;
};

export type ToastEntry = ToastOptions & {
  id: string;
  type: ToastType;
  createdAt: number;
};

type Listener = (toasts: ToastEntry[]) => void;

const DURATION_MS = 2800; // 2.5–3.5s range
const listeners = new Set<Listener>();
let toasts: ToastEntry[] = [];

function emit() {
  const snapshot = [...toasts];
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch (e) {
      console.error("[toast] listener error:", e);
    }
  });
}

function addToast(type: ToastType, options: ToastOptions) {
  const { groupId } = options;

  if (groupId) {
    toasts = toasts.filter(
      (t) => (t as ToastOptions & { groupId?: string }).groupId !== groupId
    );
  }

  const id = crypto.randomUUID();
  const entry: ToastEntry = { ...options, id, type, createdAt: Date.now() };
  toasts = [...toasts, entry];
  emit();
}

export function getToastDuration() {
  return DURATION_MS;
}

export const toast = {
  success: (options: ToastOptions | string) => {
    const opts = typeof options === "string" ? { title: options } : options;
    addToast("success", opts);
  },
  error: (options: ToastOptions | string) => {
    const opts = typeof options === "string" ? { title: options } : options;
    addToast("error", opts);
  },
  info: (options: ToastOptions | string) => {
    const opts = typeof options === "string" ? { title: options } : options;
    addToast("info", opts);
  },
  dismiss: (id: string) => {
    toasts = toasts.filter((x) => x.id !== id);
    emit();
  },
};

export function subscribeToToasts(listener: Listener) {
  listeners.add(listener);
  listener([...toasts]);
  return () => {
    listeners.delete(listener);
  };
}
