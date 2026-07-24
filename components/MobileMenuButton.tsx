interface MobileMenuButtonProps {
  open: boolean;
  onClick: () => void;
  className?: string;
}

/** Animated menu → close control for mobile nav */
export default function MobileMenuButton({
  open,
  onClick,
  className = "",
}: MobileMenuButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
      aria-expanded={open}
      className={`group relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent p-2 text-gray-700 transition-all duration-200 hover:border-gray-200/80 hover:bg-gray-100/90 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/40 focus-visible:ring-offset-2 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-800/80 dark:hover:text-white dark:focus-visible:ring-gray-100/50 dark:focus-visible:ring-offset-gray-900 lg:hidden ${className}`}
    >
      <span className="relative h-4 w-4" aria-hidden="true">
        <span
          className={`absolute left-0 top-[3px] block h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "top-[7.25px] rotate-45" : "group-hover:w-3.5"
          }`}
        />
        <span
          className={`absolute left-0 top-[7.25px] block h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "scale-x-0 opacity-0" : ""
          }`}
        />
        <span
          className={`absolute left-0 top-[11.5px] block h-[1.5px] w-4 rounded-full bg-current transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? "top-[7.25px] -rotate-45" : "group-hover:w-3"
          }`}
        />
      </span>
    </button>
  );
}
