import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { api } from '@/api'; // 🚀 頂層直連，0 嵌套！

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(''); // 前端介面顯示為電子郵件
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 🚀 實體 API 真機對接 ( postAuthLogin )
      const res = await api.postAuthLogin({ account: email, password });
      
      // 🚀 完璧對齊：直接讀取 res.data?.access_token ( 去掉 data 巢狀包裝 )
      const token = res.data?.access_token || "";
      const refreshToken = res.data?.refresh_token || "";
      
      if (token) {
        // 🚀 完璧對齊：標準寫入 access_token 與 refresh_token！
        localStorage.setItem('access_token', token);
        localStorage.setItem('refresh_token', refreshToken);
        
        setSuccessMsg("🎉 會員登入成功！正在跳轉主頁...");
        setTimeout(() => {
          router.push('/');
        }, 1500);
      } else {
        throw new Error("伺服器未返回有效的安全通行證 (access_token)");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "登入失敗，請檢查您的密碼！";
      setErrorMsg("⚠️ " + msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>會員登入 | Pangu Sandbox</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-brand-surface p-4 text-brand-text">
        <CardBodyWrapper>
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>歡迎回來</h2>
            <p className="text-sm opacity-70" style={{ color: 'var(--color-text)' }}>請輸入您的電子郵件與密碼登入會員</p>
          </div>

          {errorMsg && (
            <div 
              className="text-xs p-3.5 rounded-xl animate-shake font-medium border"
              style={{
                backgroundColor: 'rgba(var(--color-primary-rgb, 74, 107, 83), 0.08)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
                borderRadius: 'var(--border-radius)'
              }}
            >
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div 
              className="text-xs p-3.5 rounded-xl font-medium border animate-fade-in"
              style={{
                backgroundColor: 'rgba(var(--color-accent-rgb, 212, 175, 55), 0.1)',
                borderColor: 'rgba(var(--color-accent-rgb, 212, 175, 55), 0.2)',
                color: 'var(--color-accent)',
                borderRadius: 'var(--border-radius)'
              }}
            >
              {successMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            {/* 🚀 容器化隔離，間距完美，輸入框 100% 物理吞噬大師圓角與框線！ */}
            <div className="flex flex-col gap-2 text-left">
              <label className="text-xs font-bold tracking-wider opacity-85" style={{ color: 'var(--color-text)' }}>
                電子郵件
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full text-sm bg-transparent border px-4 py-3.5 outline-none transition-all duration-200 focus:border-brand-primary"
                style={{ 
                  borderColor: 'var(--color-border)', 
                  borderRadius: 'var(--border-radius)',
                  color: 'var(--color-text)'
                }}
                required
              />
            </div>

            <div className="flex flex-col gap-2 text-left">
              <label className="text-xs font-bold tracking-wider opacity-85" style={{ color: 'var(--color-text)' }}>
                密碼
              </label>
              <input
                type="password"
                placeholder="請輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm bg-transparent border px-4 py-3.5 outline-none transition-all duration-200 focus:border-brand-primary"
                style={{ 
                  borderColor: 'var(--color-border)', 
                  borderRadius: 'var(--border-radius)',
                  color: 'var(--color-text)'
                }}
                required
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  defaultChecked
                  className="rounded border-zinc-300 dark:border-zinc-800 text-brand-primary focus:ring-brand-primary bg-transparent"
                />
                <span style={{ color: 'var(--color-text)' }}>記住我</span>
              </label>
              <Link href="/auth/forgot-password" className="text-brand-primary hover:underline font-semibold">
                忘記密碼？
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-primary text-white font-semibold py-4 shadow-md transition-all duration-200 hover:opacity-90 flex items-center justify-center gap-2 outline-none"
              style={{ borderRadius: 'var(--border-radius)' }}
            >
              {isLoading ? "正在驗證憑證..." : "登入會員"}
            </button>
          </form>

          {/* 🚀 雙跳轉連結：包含免費註冊 與 返回首頁大導航！ */}
          <div className="flex flex-col gap-3 text-center text-xs pt-2">
            <span style={{ color: 'var(--color-text)' }} className="opacity-70">
              還沒有帳號嗎？{' '}
              <Link href="/auth/register" className="text-brand-primary hover:underline font-semibold">
                免費註冊
              </Link>
            </span>
            <Link href="/" className="text-brand-primary hover:underline font-bold flex items-center justify-center gap-1">
              ← 返回主故事板首頁 (Back to Home)
            </Link>
          </div>
        </CardBodyWrapper>
      </div>
    </>
  );
}

// 🚀 自適應 Card 包裹器，完全抽離 NextUI，保持代碼最純淨、最吃主題！
function CardBodyWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div 
      className="w-full max-w-md p-8 space-y-6 border transition-all duration-300"
      style={{ 
        backgroundColor: 'var(--color-card)', 
        borderColor: 'var(--color-border)',
        borderWidth: '1px',
        borderRadius: 'var(--border-radius)',
        boxShadow: 'var(--brand-shadow)'
      }}
    >
      {children}
    </div>
  );
}
