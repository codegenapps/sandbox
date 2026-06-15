import type { AppProps } from 'next/app';
import Head from 'next/head';
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
      <main className='text-brand-text bg-brand-surface min-h-screen' suppressHydrationWarning>
        <Component {...pageProps} />
      </main>
    </QueryClientProvider>
  );
}