import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { useDarkMode } from "./DarkModeContext";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 2000;

function ToastIcon({ type, color }: { type: ToastType; color: string }) {
  if (type === "success") {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="block"
      >
        <path
          d="M5 13l4 4L19 7"
          stroke={color}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (type === "error") {
    return (
      <svg width="14" height="14" viewBox="0 0 20 20" fill={color} aria-hidden className="block">
        <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
      </svg>
    );
  }
  if (type === "warning") {
    return (
      <svg width="14" height="14" viewBox="0 0 20 20" fill={color} aria-hidden className="block">
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill={color} aria-hidden className="block">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.94 6.94a.75.75 0 1 1-1.061-1.061 3 3 0 1 1 2.871 5.026v.345a.75.75 0 0 1-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 1 0 8.94 6.94ZM10 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
      />
    </svg>
  );
}

function ToastViewport({
  toasts,
  removeToast,
}: {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}) {
  const { isDarkMode } = useDarkMode();
  // Light = black bubble + white text; dark = white bubble + black text.
  const bubbleStyle = isDarkMode
    ? {
        backgroundColor: "#ffffff",
        borderColor: "rgba(0,0,0,0.08)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.28)",
      }
    : {
        backgroundColor: "#0a0a0a",
        borderColor: "rgba(0,0,0,0.2)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.22)",
      };
  const textClass = isDarkMode
    ? "text-center text-[13px] font-medium leading-snug text-gray-900 sm:text-sm"
    : "text-center text-[13px] font-medium leading-snug text-white sm:text-sm";
  const closeClass = isDarkMode
    ? "absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 transition hover:bg-black/5 hover:text-gray-900"
    : "absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white";
  const iconColor = isDarkMode ? "#111827" : "#ffffff";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[200] flex justify-center px-3 sm:px-6"
      style={{ top: "calc(4.75rem + env(safe-area-inset-top, 0px))" }}
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="flex w-auto max-w-[min(22rem,calc(100vw-1.5rem))] flex-col items-center gap-2 sm:max-w-md">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              role="status"
              className="pointer-events-auto w-fit max-w-full overflow-hidden rounded-full border"
              style={bubbleStyle}
            >
              <div className="relative flex items-center justify-center gap-2 px-4 py-2.5 pr-9 sm:gap-2.5 sm:px-5 sm:py-3 sm:pr-10">
                <span className="inline-flex shrink-0 items-center justify-center" aria-hidden>
                  <ToastIcon type={toast.type} color={iconColor} />
                </span>
                <p className={textClass}>{toast.message}</p>
                <button type="button" onClick={() => removeToast(toast.id)} className={closeClass}>
                  <span className="sr-only">Fermer</span>
                  <svg
                    width={14}
                    height={14}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                    className="block"
                  >
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration = DEFAULT_DURATION_MS) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev.slice(-2), { id, message, type, duration }]);
      window.setTimeout(() => removeToast(id), duration);
    },
    [removeToast]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (message: string, duration?: number) => showToast(message, "success", duration),
      error: (message: string, duration?: number) => showToast(message, "error", duration),
      info: (message: string, duration?: number) => showToast(message, "info", duration),
      warning: (message: string, duration?: number) => showToast(message, "warning", duration),
    }),
    [showToast]
  );

  const toastViewport =
    mounted &&
    createPortal(<ToastViewport toasts={toasts} removeToast={removeToast} />, document.body);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toastViewport}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
