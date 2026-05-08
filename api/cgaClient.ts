import cga from '@codegenapps/frontend-sdk';

// 💡 智慧環境變數讀取：自動相容 Next.js (process.env) 與 Vite (import.meta.env)
const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) return import.meta.env[key];
  return '';
};

if (typeof window !== 'undefined') {
  cga.init({
    baseUrl: getEnv('NEXT_PUBLIC_CGA_API_URL'),
    apiKey: getEnv('NEXT_PUBLIC_CGA_API_KEY'),
    getToken: () => localStorage.getItem('access_token'),
    getRefreshToken: () => localStorage.getItem('refresh_token'),
    onTokensRefreshed: (accessToken: string, refreshToken: string) => {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
    }
  });
}

/**
 * CGA SDK Usage Example:
 * 
 * 1. Always await cga.ready() first
 * 2. await cga.from('path').get().run()
 */
export { cga };