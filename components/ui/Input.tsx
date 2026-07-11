import { InputHTMLAttributes, ReactNode, forwardRef } from "react";

import {
  formFieldClass,
  formFieldErrorClass,
  formFieldLabelClass,
} from "../../lib/form-field-styles";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  endAction?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { label, error, helperText, icon, iconPosition = "left", endAction, className = "", ...props },
    ref
  ) => {
    const errorClasses = error ? formFieldErrorClass : "";
    const iconClasses = icon ? (iconPosition === "left" ? "pl-10" : "pr-10") : "";
    const finalClasses = `${formFieldClass} ${errorClasses} ${iconClasses} ${className}`.trim();

    return (
      <div className="space-y-1">
        {label && <label className={formFieldLabelClass}>{label}</label>}

        <div className={endAction ? "flex flex-col gap-3 sm:flex-row sm:items-center" : undefined}>
          <div className="relative min-w-0 flex-1">
            {icon && iconPosition === "left" && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>
            )}

            <input ref={ref} className={finalClasses} {...props} />

            {icon && iconPosition === "right" && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>
            )}
          </div>

          {endAction && <div className="shrink-0">{endAction}</div>}
        </div>

        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

        {helperText && !error && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
