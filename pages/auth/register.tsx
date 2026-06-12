import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { api } from '@/api'; // 🚀 頂層直連，0 嵌套！

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) {
      setErrorMsg('⚠️ 請先閱讀並同意服務條款');
      return;
    }
    
    if (password.length < 8) {
      setErrorMsg('⚠️ 密碼設定失敗：密碼長度必須至少為 8 個字元！');
      return;
    }
    
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.postAuthRegister({ account: email, password });
      setSuccessMsg("🎉 帳號註冊成功！正在跳轉至登入頁面...");
      setTimeout(() => {
        router.push('/auth/login');
      }, 1500);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "註冊失敗，該電子信箱可能已被使用！";
      setErrorMsg("⚠️ " + msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>免費註冊 | Pangu Sandbox</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-brand-surface p-4 text-brand-text">
        <CardBodyWrapper>
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>創立新帳號</h2>
            <p className="text-sm opacity-70" style={{ color: 'var(--color-text)' }}>立即加入，開啟您的美學與教育探索之旅</p>
          </div>

          {/* 自適應提示橫幅 */}
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

          <form onSubmit={handleRegister} className="space-y-6">
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
                設定密碼
              </label>
              <input
                type="password"
                placeholder="請設定至少 8 位數密碼"
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

            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input 
                type="checkbox" 
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-800 text-brand-primary focus:ring-brand-primary bg-transparent"
              />
              <span style={{ color: 'var(--color-text)' }}>我已閱讀並同意使用條款與隱私權保護政策</span>
            </label>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-primary text-white font-semibold py-4 shadow-md transition-all duration-200 hover:opacity-90 flex items-center justify-center gap-2 outline-none"
              style={{ borderRadius: 'var(--border-radius)' }}
            >
              {isLoading ? "正在提交資料..." : "免費註冊帳號"}
            </button>
          </form>

          {/* 🚀 雙跳轉連結：包含登入會員 與 返回首頁大導航！ */}
          <div className="flex flex-col gap-3 text-center text-xs pt-2">
            <span style={{ color: 'var(--color-text)' }} className="opacity-70">
              已經有帳號了？{' '}
              <Link href="/auth/login" className="text-brand-primary hover:underline font-semibold">
                登入會員
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
