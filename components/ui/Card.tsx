import { ReactNode } from "react";
import { motion } from "framer-motion";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  shadow?: "sm" | "md" | "lg" | "xl";
}

export default function Card({
  children,
  className = "",
  hover = false,
  padding = "md",
  shadow = "md",
}: CardProps) {
  const paddingClasses = {
    none: "p-0",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  const shadowClasses = {
    sm: "shadow-sm",
    md: "shadow-lg",
    lg: "shadow-xl",
    xl: "shadow-2xl",
  };

  const baseClasses = `rounded-xl border border-gray-200/80 bg-white dark:border-gray-700/60 dark:bg-gray-800 ${paddingClasses[padding]} ${shadowClasses[shadow]}`;
  const hoverClasses = hover ? "transition-all duration-300 hover:shadow-xl" : "";
  const finalClasses = `${baseClasses} ${hoverClasses} ${className}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={finalClasses}
    >
      {children}
    </motion.div>
  );
}
