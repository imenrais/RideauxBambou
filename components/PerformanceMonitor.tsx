import { useEffect } from "react";

interface PerformanceMonitorProps {
  pageName: string;
}

export default function PerformanceMonitor({ pageName }: PerformanceMonitorProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      const startTime = performance.now();

      const handleLoad = () => {
        const endTime = performance.now();
        const loadTime = endTime - startTime;

        console.log(`🚀 ${pageName} loaded in ${loadTime.toFixed(2)}ms`);

        // Log Core Web Vitals
        if ("web-vital" in window) {
          // This would be used with web-vitals library
          console.log("📊 Core Web Vitals available");
        }
      };

      if (document.readyState === "complete") {
        handleLoad();
      } else {
        window.addEventListener("load", handleLoad);
      }

      return () => {
        window.removeEventListener("load", handleLoad);
      };
    }
  }, [pageName]);

  return null;
}
