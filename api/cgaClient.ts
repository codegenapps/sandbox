import cga from '@codegenapps/frontend-sdk';
import schemaData from './schema.json';

const isSandbox = process.env.NEXT_PUBLIC_IS_SANDBOX === 'true';

if (typeof window !== 'undefined') {
  cga.init({
    baseUrl: process.env.NEXT_PUBLIC_CGA_API_URL || '',
    apiKey: process.env.NEXT_PUBLIC_CGA_API_KEY || '',
    schema: isSandbox ? schemaData : undefined, // 沙盒內強制靜態載入以確保穩定性
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
 * 
 * Example:
 * const { data, error } = await cga.from('products').get().run();
 */
export { cga };