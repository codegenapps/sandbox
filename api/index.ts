import axios from 'axios';
// @ts-ignore
import { Api } from './generated/Api';

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

const axiosInstance = axios.create({
  baseURL: getApiUrl(),
});

// 自動攔截並注入 Token 與 API Key
axiosInstance.interceptors.request.use((config) => {
  let token = '';
  // 嘗試從 localStorage 或 sessionStorage 拿 token (適應大部分前端環境)
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('access_token') || '';
  }
  
  if (token) {
    config.headers.Authorization = 'Bearer ' + token;
  }

  // 🌟 注入全域 API KEY (重要：用於 Login 與基礎授權)
  const apiKey = getApiKey();
  if (apiKey) {
    config.headers['x-api-key'] = apiKey;
  }
  
  return config;
});

export const api = new Api({ instance: axiosInstance });
