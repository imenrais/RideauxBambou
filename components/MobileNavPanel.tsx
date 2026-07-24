import { AnimatePresence, motion } from "framer-motion";
import { ReactNode } from "react";

interface MobileNavPanelProps {
  open: boolean;
  children: ReactNode;
}

/** Shared modern mobile nav dropdown shell */
export function MobileNavPanel({ open, children }: MobileNavPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden lg:hidden"
        >
          <div className="border-t border-gray-200/70 pb-3 pt-2 dark:border-gray-700/70">
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, delay: 0.04 }}
              className="rounded-2xl border border-gray-200/70 bg-white/90 p-1.5 shadow-sm shadow-gray-900/5 ring-1 ring-black/[0.03] backdrop-blur-md dark:border-gray-700/70 dark:bg-gray-800/90 dark:shadow-black/20 dark:ring-white/[0.04]"
            >
              <nav className="flex flex-col gap-0.5">{children}</nav>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function mobileNavLinkClass(isActive: boolean) {
  return `group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-[0.95rem] font-medium tracking-[0.01em] transition-all duration-200 ease-out ${
    isActive
      ? "bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900"
      : "text-gray-700 hover:bg-gray-100/90 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/60 dark:hover:text-white"
  }`;
}

export function MobileNavLinkAccent({ isActive }: { isActive: boolean }) {
  if (isActive) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300 opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:bg-gray-500"
    />
  );
}
