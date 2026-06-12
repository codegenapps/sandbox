import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { api } from '@/api'; // 🚀 頂層直連，0 嵌套！

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.postAuthForgotPassword({ account: email });
      setSuccessMsg("🎉 密碼重設郵件已發送！請至您的信箱收取重設連結。");
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "發送失敗，請檢查電子郵箱是否輸入正確！";
      setErrorMsg("⚠️ " + msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>重設密碼 | Pangu Sandbox</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-brand-surface p-4 text-brand-text">
        {/* 🚀 卡片本體：100% 物理吞噬大師圓角、光影、卡片背景！與主題完全合流！ */}
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
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>忘記密碼？</h2>
            <p className="text-sm opacity-70 font-normal" style={{ color: 'var(--color-text)' }}>請輸入您的註冊信箱，我們將向您發送密碼重設連結</p>
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

          <form onSubmit={handleReset} className="space-y-6">
            {/* 🚀 容器化隔離，間距完美，輸入框 100% 物理吞噬大師圓角與框線！ */}
            <div className="flex flex-col gap-2 text-left">
              <label className="text-xs font-bold tracking-wider opacity-85" style={{ color: 'var(--color-text)' }}>
                註冊電子郵件
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

            {/* 🚀 按鈕：100% 自適應大師圓角 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand-primary text-white font-semibold py-4 shadow-md transition-all duration-200 hover:opacity-90 flex items-center justify-center gap-2 outline-none"
              style={{ borderRadius: 'var(--border-radius)' }}
            >
              {isLoading ? "正在發送重設郵件..." : "發送重設郵件"}
            </button>
          </form>

          <div className="text-center text-sm">
            <Link href="/auth/login" className="text-brand-primary hover:underline font-semibold flex items-center justify-center gap-1 text-xs">
              ← 返回登入會員
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
