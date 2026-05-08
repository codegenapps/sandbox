import cga from '@codegenapps/frontend-sdk';

// 💡 智慧環境變數讀取：避免使用動態 key (import.meta.env[key])，因為 Vite 必須靜態替換字串
const getApiUrl = () => {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_CGA_API_URL) return process.env.NEXT_PUBLIC_CGA_API_URL;
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_CGA_API_URL) return import.meta.env.NEXT_PUBLIC_CGA_API_URL;
  return '';
};

const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_CGA_API_KEY) return process.env.NEXT_PUBLIC_CGA_API_KEY;
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_CGA_API_KEY) return import.meta.env.NEXT_PUBLIC_CGA_API_KEY;
  return '';
};

if (typeof window !== 'undefined') {
  cga.init({
    baseUrl: getApiUrl(),
    apiKey: getApiKey(),
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