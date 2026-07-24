import { ReactNode, ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  icon,
  iconPosition = "left",
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center leading-none font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

  const variantClasses = {
    primary:
      "rounded-xl bg-gray-900 text-white shadow-lg hover:bg-gray-800 hover:shadow-xl focus:ring-gray-500/40 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100",
    secondary:
      "rounded-xl border border-gray-300 bg-white text-gray-800 shadow-sm hover:bg-gray-50 hover:shadow-md focus:ring-gray-400/40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
    ghost:
      "rounded-xl text-gray-800 hover:bg-gray-200/80 focus:ring-gray-400/40 dark:text-gray-300 dark:hover:bg-gray-800/80",
    danger:
      "rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg hover:from-red-700 hover:to-red-800 hover:shadow-xl focus:ring-red-500/50",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm",
    md: "px-4 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base",
    lg: "px-5 py-3 text-base sm:px-8 sm:py-4 sm:text-lg",
  };

  const widthClasses = fullWidth ? "w-full" : "";
  const finalClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClasses} ${className}`;

  return (
    <button className={finalClasses} disabled={disabled || loading} {...props}>
      {loading && (
        <svg className="mr-2 h-4 w-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}

      {!loading && icon && iconPosition === "left" && (
        <span className="mr-1.5 inline-flex shrink-0 items-center justify-center sm:mr-2 [&>svg]:block">
          {icon}
        </span>
      )}

      <span className="inline-flex items-center leading-none">{children}</span>

      {!loading && icon && iconPosition === "right" && (
        <span className="ml-1.5 inline-flex shrink-0 items-center justify-center sm:ml-2 [&>svg]:block">
          {icon}
        </span>
      )}
    </button>
  );
}
