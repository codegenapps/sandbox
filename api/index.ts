import axios from 'axios';
// @ts-ignore
import { Api } from './generated/Api';

const getApiUrl = () => {
  // 1. Node.js / Next.js 環境
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_CGA_API_URL) {
    return process.env.NEXT_PUBLIC_CGA_API_URL;
  }
  // 2. Vite / ESM 環境
  try {
    // @ts-ignore
    if (import.meta && import.meta.env) {
      // @ts-ignore
      return import.meta.env.VITE_CGA_API_URL || import.meta.env.NEXT_PUBLIC_CGA_API_URL || '';
    }
  } catch (e) {}
  return '';
};

const getApiKey = () => {
  // 1. Node.js / Next.js 環境
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_CGA_API_KEY) {
    return process.env.NEXT_PUBLIC_CGA_API_KEY;
  }
  // 2. Vite / ESM 環境
  try {
    // @ts-ignore
    if (import.meta && import.meta.env) {
      // @ts-ignore
      return import.meta.env.VITE_CGA_API_KEY || import.meta.env.NEXT_PUBLIC_CGA_API_KEY || '';
    }
  } catch (e) {}
  return '';
};

const cgaBaseUrl = getApiUrl();

// 💡 1. 直接實例化 Api，將 baseURL 傳入，讓 SDK 底層自己建立正確的 Axios instance
export const api = new Api({
  baseURL: cgaBaseUrl,
});

// 💡 2. 直接對 SDK 內部的 axios 實體掛載攔截器
api.instance.interceptors.request.use((config) => {
  let token = '';
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('access_token') || '';
  }
  
  if (token) {
    config.headers.Authorization = 'Bearer ' + token;
  }

  const apiKey = getApiKey();
  if (apiKey) {
    config.headers['x-api-key'] = apiKey;
  }
  
  return config;
});
