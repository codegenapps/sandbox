import type { AppProps } from 'next/app';
import Head from 'next/head';
import Script from 'next/script';
import { NextUIProvider } from '@nextui-org/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import '../styles/globals.css';

const queryClient = new QueryClient();

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  return (
    <QueryClientProvider client={queryClient}>
      <Head>
        <title>CGA Shadow Node</title>
      </Head>
      <NextUIProvider navigate={router.push}>
        <main className='dark text-foreground bg-background min-h-screen' suppressHydrationWarning>
          <Component {...pageProps} />
        </main>
      </NextUIProvider>
    </QueryClientProvider>
  );
}