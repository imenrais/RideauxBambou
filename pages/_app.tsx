import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppProps } from "next/app";
import Head from "next/head";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";

import { CartProvider } from "../contexts/CartContext";
import { DarkModeProvider } from "../contexts/DarkModeContext";
import { SimpleCartProvider } from "../contexts/SimpleCartContext";
import { ToastProvider } from "../contexts/ToastContext";
// DevToolsWrapper removed for production
import "../styles/globals.css";

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes - increased for better performance
            gcTime: 10 * 60 * 1000, // 10 minutes - keep data in cache longer
            retry: (failureCount, error) => {
              if (error instanceof Error && "status" in error) {
                const status = (error as any).status;
                if (status >= 400 && status < 500) {
                  return false; // Don't retry client errors
                }
              }
              return failureCount < 2; // Reduced retries for faster failure
            },
            refetchOnWindowFocus: false, // Disabled for better performance
            refetchOnReconnect: false, // Disabled to prevent unnecessary refetches
            refetchOnMount: false, // Use cached data when available
          },
          mutations: {
            retry: false, // No retries for mutations
            retryDelay: 0,
          },
        },
      })
  );

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="format-detection" content="telephone=no" />
        </Head>
        <DarkModeProvider>
          <CartProvider>
            <SimpleCartProvider>
              <ToastProvider>
                <Component {...pageProps} />
              </ToastProvider>
            </SimpleCartProvider>
          </CartProvider>
        </DarkModeProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
