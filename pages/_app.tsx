import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AppProps } from "next/app";
import Head from "next/head";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";

import { CartProvider } from "../contexts/CartContext";
import { DarkModeProvider } from "../contexts/DarkModeContext";
import { SimpleCartProvider } from "../contexts/SimpleCartContext";
import { ToastProvider } from "../contexts/ToastContext";
import "../styles/globals.css";

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: (failureCount, error) => {
              if (error instanceof Error && "status" in error) {
                const status = (error as any).status;
                if (status >= 400 && status < 500) {
                  return false;
                }
              }
              return failureCount < 2;
            },
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: false,
          },
          mutations: {
            retry: false,
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
