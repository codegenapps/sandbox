import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { api } from '@/api'; // 🚀 一鍵直連實體 API 客戶端

export default function ProfilePage() {
  const router = useRouter();
  
  const [userId, setUserId] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 💡 實時加載
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          router.push('/auth/login');
          return;
        }

        const res = await api.getUsersMe();
        const user = res.data || res;
        
        if (user && user.id) {
          setUserId(Number(user.id));
          setEmail(user.account || '');
        } else {
          throw new Error("無法安全解析用戶憑證資訊 (id 欄位缺失)");
        }
      } catch (err: any) {
        console.error("載入個人資料失敗:", err);
        localStorage.removeItem('access_token');
        router.push('/auth/login');
      } finally {
        setIsPageLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  // 🚀 實體 API 保存修改
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (password && password.length < 8) {
      setErrorMsg('⚠️ 密碼更新失敗：密碼長度必須至少為 8 個字元！');
      setIsSaving(false);
      return;
    }

    try {
      const payload: any = { account: email };
      if (password) {
        payload.password = password;
      }

      await api.putUsersId(userId, payload);
      setSuccessMsg("🎉 個人資料已成功保存至 Go 雲端資料庫！");
      setPassword(''); 
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "更新失敗，該帳號可能已被佔用！";
      setErrorMsg("⚠️ " + msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-surface text-brand-text">
        <div className="text-sm font-semibold opacity-70 animate-pulse">正在加載會員設定中心資料...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>個人資料設定 | Pangu Sandbox</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-brand-surface p-4 text-brand-text">
        {/* 🚀 卡片本體：100% 純淨自適應大師圓角與光影 */}
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
            <h2 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--color-text)' }}>會員設定中心</h2>
            <p className="text-sm opacity-70" style={{ color: 'var(--color-text)' }}>更新您的帳號資料與安全密碼</p>
          </div>

          {/* 自適應提示橫幅：100% 綁定品牌主色與輔助色 */}
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

          <form onSubmit={handleUpdateProfile} className="space-y-6">
            {/* 🚀 每個輸入框使用 flex-col 容器化隔離，間距完美，文字絕對不再碰撞跑版！ */}
            <div className="flex flex-col gap-2 text-left">
              <label className="text-xs font-bold tracking-wider opacity-85" style={{ color: 'var(--color-text)' }}>
                會員帳號
              </label>
              <input
                type="email"
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
                新密碼 (不更改請留空)
              </label>
              <input
                type="password"
                placeholder="輸入新密碼以進行安全更新"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-sm bg-transparent border px-4 py-3.5 outline-none transition-all duration-200 focus:border-brand-primary"
                style={{ 
                  borderColor: 'var(--color-border)', 
                  borderRadius: 'var(--border-radius)',
                  color: 'var(--color-text)'
                }}
              />
            </div>

            {/* 🚀 原生 HTML 按鈕，輕量，100% 變數統治！ */}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-brand-primary text-white font-semibold py-4 shadow-md transition-all duration-200 hover:opacity-90 flex items-center justify-center gap-2 outline-none"
              style={{ borderRadius: 'var(--border-radius)' }}
            >
              {isSaving ? "正在保存資料..." : "保存修改資料"}
            </button>
          </form>

          <div className="text-center text-sm">
            <Link href="/" className="text-brand-primary hover:underline font-semibold flex items-center justify-center gap-1 text-xs">
              ← 返回主控制台
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
