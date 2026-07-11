import { motion } from "framer-motion";
import { useRouter } from "next/router";

interface BackButtonProps {
  href?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function BackButton({ href: _href, className = "", children: _children }: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    const fallbackPath = router.pathname.startsWith("/admin") ? "/admin" : "/";
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackPath);
  };

  return (
    <motion.button
      onClick={handleBack}
      whileHover={{ scale: 1.05, x: -2 }}
      whileTap={{ scale: 0.95 }}
      className={`group flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shadow-lg ring-1 ring-gray-200/50 backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow-xl hover:ring-gray-300/50 dark:bg-gray-800/80 dark:ring-gray-700/50 dark:hover:bg-gray-800 dark:hover:ring-gray-600/50 ${className}`}
    >
      <svg
        className="h-5 w-5 text-gray-700 transition-colors group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-white"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
      </svg>
    </motion.button>
  );
}
