import { motion } from "framer-motion";

interface LoadingProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

export default function Loading({
  size = "md",
  text = "Chargement...",
  fullScreen = false,
  className = "",
}: LoadingProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const textSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  const containerClasses = fullScreen
    ? "flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-amber-50 dark:bg-gray-900"
    : "flex items-center justify-center";

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="flex flex-col items-center space-y-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className={`${sizeClasses[size]} rounded-full border-2 border-gray-300 border-t-green-600`}
        />
        {text && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className={`${textSizeClasses[size]} text-gray-600 dark:text-gray-400`}
          >
            {text}
          </motion.p>
        )}
      </div>
    </div>
  );
}
