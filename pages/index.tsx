import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { api } from '@/api'; // 🚀 一鍵接通實體 API

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // 💡 控制艙分類選單：dashboard, forms, lists, navigation
  const [activeCategory, setActiveCategory] = useState('dashboard');

  // 💡 實施互動狀態 (Toggle, Radio, Dropdown)
  const [isToggled, setIsToggled] = useState(true);
  const [selectedRadio, setSelectedRadio] = useState('option-1');
  const [isDropdownOpen, setIsDropdownOpen] = useState(true); // 預設開啟展示吃主題

  // 💡 實時狀態感應
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      setIsLoggedIn(!!token);
    }
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await api.postAuthLogout();
    } catch (e) {
      console.warn("API 登出失敗...", e);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setIsLoggedIn(false);
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <Head>
        <title>Pangu Sandbox | Ready for AIGC Creation</title>
      </Head>
      <div className="min-h-screen bg-brand-surface text-brand-text p-4 md:p-8 transition-colors duration-300">
        
        {/* 🚀 主控台頂欄 (Header) */}
        <div className="max-w-6xl mx-auto flex items-center justify-between pb-8 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 bg-brand-primary/10 border border-brand-primary flex items-center justify-center font-bold text-brand-primary animate-pulse"
              style={{ borderRadius: 'var(--border-radius)' }}
            >
              CGA
            </div>
            <div className="text-left">
              <h1 className="text-md font-bold tracking-tight">Pangu Storyboard</h1>
              <p className="text-[10px] opacity-60">Design System & Real-API Controller</p>
            </div>
          </div>
          
          <div className="text-xs">
            {isLoggedIn ? (
              <span className="text-green-500 font-semibold">● 伺服器已連線</span>
            ) : (
              <span className="opacity-50">○ 訪客模式</span>
            )}
          </div>
        </div>

        {/* 🚀 故事板主版塊 */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 pt-8">
          
          {/* 左側：控制艙（Control Room） */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* C1. 會員認證艙 */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold tracking-wider opacity-60 uppercase text-left">控制艙 (Control Room)</h3>
              {isLoggedIn ? (
                <div 
                  className="p-5 border backdrop-blur-md space-y-4 animate-fade-in text-left transition-all duration-300"
                  style={{
                    backgroundColor: 'var(--color-card)',
                    borderColor: 'var(--color-border)',
                    borderRadius: 'var(--border-radius)',
                    boxShadow: 'var(--brand-shadow)',
                    borderWidth: '1px'
                  }}
                >
                  <div className="text-sm font-semibold text-brand-primary">
                    🎉 您已登入驗證！
                  </div>
                  <p className="text-[11px] opacity-75 leading-relaxed" style={{ color: 'var(--color-text)' }}>
                    歡迎回來！後台 API 讀寫已通。您可以進入設定中心修改您的個人帳密資料。
                  </p>
                  <div className="flex flex-col gap-2 w-full">
                    {/* 🚀 智慧對比：主色按鈕上的字體，100% 綁定 --color-on-primary 變量！徹底杜絕白底白字！ */}
                    <Link 
                      href="/profile"
                      className="w-full bg-brand-primary font-bold py-2.5 text-center text-xs shadow-md hover:opacity-90 transition-all duration-200 flex items-center justify-center outline-none"
                      style={{ 
                        borderRadius: 'var(--border-radius)',
                        color: 'var(--color-on-primary)'
                      }}
                    >
                      進入會員設定中心 (Profile)
                    </Link>
                    <button 
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="w-full bg-brand-accent font-semibold py-2.5 text-xs shadow-lg hover:opacity-90 transition-opacity outline-none"
                      style={{ 
                        borderRadius: 'var(--border-radius)',
                        color: 'var(--color-on-accent)' // 🚀 輔助色對比色
                      }}
                    >
                      {isLoggingOut ? "正在安全登出..." : "安全登出會員 (Log Out)"}
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="p-5 border backdrop-blur-md space-y-4 animate-fade-in text-left transition-all duration-300"
                  style={{
                    backgroundColor: 'var(--color-card)',
                    borderColor: 'var(--color-border)',
                    borderRadius: 'var(--border-radius)',
                    boxShadow: 'var(--brand-shadow)',
                    borderWidth: '1px'
                  }}
                >
                  <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                    🔒 訪客安全驗證
                  </div>
                  <p className="text-[11px] opacity-75 leading-relaxed" style={{ color: 'var(--color-text)' }}>
                    點擊下方按鈕測試真機 API 連通性。出廠自帶註冊限制與登入 Token 自動緩存。
                  </p>
                  <div className="flex flex-col gap-2 w-full">
                    {/* 🚀 智慧對比：主色按鈕上的字體，100% 綁定 --color-on-primary 變量！徹底杜絕白底白字！ */}
                    <Link 
                      href="/auth/login"
                      className="w-full bg-brand-primary font-bold py-2.5 text-center text-xs shadow-md hover:opacity-90 transition-all duration-200 flex items-center justify-center outline-none"
                      style={{ 
                        borderRadius: 'var(--border-radius)',
                        color: 'var(--color-on-primary)'
                      }}
                    >
                      Review 會員登入
                    </Link>
                    <Link 
                      href="/auth/register"
                      className="w-full border border-brand-primary text-brand-primary font-semibold py-2.5 text-center text-xs hover:bg-brand-primary/5 transition-all duration-200 flex items-center justify-center outline-none"
                      style={{ 
                        borderRadius: 'var(--border-radius)',
                        borderColor: 'var(--color-primary)'
                      }}
                    >
                      Review 免費註冊
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* C2. 元件圖鑑分類切換器 */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold tracking-wider opacity-60 uppercase text-left">元件故事板圖鑑 (Explorer)</h3>
              <div 
                className="p-3 border backdrop-blur-md flex flex-col gap-1.5 transition-all duration-300"
                style={{
                  backgroundColor: 'var(--color-card)',
                  borderColor: 'var(--color-border)',
                  borderRadius: 'var(--border-radius)',
                  boxShadow: 'var(--brand-shadow)',
                  borderWidth: '1px'
                }}
              >
                {[
                  { id: 'dashboard', label: '📊 數據看板 (Dashboard)' },
                  { id: 'forms', label: '📝 表單控制 (Forms & Inputs)' },
                  { id: 'lists', label: '📰 圖文列表 (Cards & Lists)' },
                  { id: 'navigation', label: '🗺️ 導覽與佈局 (Navbar & Headers)' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCategory(tab.id)}
                    className={`w-full text-left text-xs px-4 py-3 rounded-lg transition-all duration-200 outline-none flex items-center justify-between ${
                      activeCategory === tab.id 
                        ? 'bg-brand-primary/10 text-brand-primary font-bold border-l-3 border-brand-primary' 
                        : 'hover:bg-brand-primary/5 opacity-70 hover:opacity-100'
                    }`}
                    style={{ borderRadius: activeCategory === tab.id ? 'var(--border-radius)' : '8px' }}
                  >
                    <span>{tab.label}</span>
                    {activeCategory === tab.id && <span className="text-[10px]">●</span>}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* 右側：組件大師故事板 */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* 📊 軌道 A. 數據看板 */}
            {activeCategory === 'dashboard' && (
              <div className="space-y-6 animate-fade-in">
                <h3 className="text-xs font-bold tracking-wider opacity-60 uppercase text-left">大廠 SaaS 數據指標與用戶分析表</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div 
                    className="p-5 border backdrop-blur-sm space-y-2 text-left transition-all duration-300"
                    style={{ 
                      backgroundColor: 'var(--color-card)', 
                      borderColor: 'var(--color-border)', 
                      borderRadius: 'var(--border-radius)',
                      boxShadow: 'var(--brand-shadow)',
                      borderWidth: '1px'
                    }}
                  >
                    <span className="text-[10px] uppercase tracking-wider opacity-60 font-semibold" style={{ color: 'var(--color-text)' }}>經常性營收 (MRR)</span>
                    <h4 className="text-2xl font-black text-brand-primary">$128,450</h4>
                    <div className="text-[9px] text-green-500 font-medium">↑ +14.2% 本月新增</div>
                  </div>

                  <div 
                    className="p-5 border backdrop-blur-sm space-y-2 text-left transition-all duration-300"
                    style={{ 
                      backgroundColor: 'var(--color-card)', 
                      borderColor: 'var(--color-border)', 
                      borderRadius: 'var(--border-radius)',
                      boxShadow: 'var(--brand-shadow)',
                      borderWidth: '1px'
                    }}
                  >
                    <span className="text-[10px] uppercase tracking-wider opacity-60 font-semibold" style={{ color: 'var(--color-text)' }}>實時在線 (Users)</span>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-brand-primary animate-ping" />
                      <h4 className="text-2xl font-black text-brand-primary">1,482</h4>
                    </div>
                    <div className="text-[9px] opacity-50" style={{ color: 'var(--color-text)' }}>API 核心讀寫正常</div>
                  </div>

                  <div 
                    className="p-5 border backdrop-blur-sm space-y-2 text-left transition-all duration-300"
                    style={{ 
                      backgroundColor: 'var(--color-card)', 
                      borderColor: 'var(--color-border)', 
                      borderRadius: 'var(--border-radius)',
                      boxShadow: 'var(--brand-shadow)',
                      borderWidth: '1px'
                    }}
                  >
                    <span className="text-[10px] uppercase tracking-wider opacity-60 font-semibold" style={{ color: 'var(--color-text)' }}>付費轉換率 (CVR)</span>
                    <h4 className="text-2xl font-black text-brand-accent">4.82%</h4>
                    <div className="text-[9px]" style={{ color: 'var(--color-accent)' }}>★ CVR 高達 92%</div>
                  </div>
                </div>

                <div 
                  className="border overflow-hidden transition-all duration-300"
                  style={{ 
                    backgroundColor: 'var(--color-card)', 
                    borderColor: 'var(--color-border)', 
                    borderRadius: 'var(--border-radius)',
                    boxShadow: 'var(--brand-shadow)',
                    borderWidth: '1px'
                  }}
                >
                  <div className="px-6 py-4 border-b text-left" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>系統活躍會員名單 (Active Members Table)</span>
                  </div>
                  <div className="overflow-x-auto text-left">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b opacity-60" style={{ borderColor: 'var(--color-border)' }}>
                          <th className="px-6 py-3 font-semibold text-left">帳號資訊 (Account)</th>
                          <th className="px-6 py-3 font-semibold text-left">專案歸屬 (ID)</th>
                          <th className="px-6 py-3 font-semibold text-left">通電狀態 (Status)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                        <tr>
                          <td className="px-6 py-4 font-medium" style={{ color: 'var(--color-text)' }}>babyandy0111@gmail.com</td>
                          <td className="px-6 py-4 opacity-75">ID: 007</td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 text-[9px] font-bold bg-brand-accent/10 text-brand-accent" style={{ borderRadius: 'var(--border-radius)' }}>
                              ONLINE
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 📝 軌道 B. 表單控制 */}
            {activeCategory === 'forms' && (
              <div className="space-y-6 animate-fade-in">
                <h3 className="text-xs font-bold tracking-wider opacity-60 uppercase text-left">大廠表單、按鈕與輸入框元件</h3>
                
                <div 
                  className="p-6 border backdrop-blur-md space-y-6 text-left transition-all duration-300"
                  style={{ 
                    backgroundColor: 'var(--color-card)', 
                    borderColor: 'var(--color-border)', 
                    borderRadius: 'var(--border-radius)',
                    boxShadow: 'var(--brand-shadow)',
                    borderWidth: '1px'
                  }}
                >
                  {/* 按鈕系列 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button 
                      className="text-xs font-semibold py-3 shadow-md hover:opacity-90 transition-all duration-200 outline-none bg-brand-primary"
                      style={{ 
                        borderRadius: 'var(--border-radius-button)', 
                        color: 'var(--color-on-primary)' // 🚀 主色文字對比度！
                      }}
                    >
                      Primary
                    </button>
                    <button 
                      className="bg-brand-accent text-white text-xs font-semibold py-3 shadow-lg hover:opacity-90 transition-all duration-200 outline-none"
                      style={{ 
                        borderRadius: 'var(--border-radius-button)',
                        color: 'var(--color-on-accent)' // 🚀 輔助色文字對比度！
                      }}
                    >
                      Accent
                    </button>
                    <button 
                      className="border text-xs font-semibold py-3 hover:bg-brand-primary/5 transition-all duration-200 outline-none"
                      style={{ 
                        borderRadius: 'var(--border-radius-button)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text)'
                      }}
                    >
                      Outlined
                    </button>
                    <button disabled className="bg-zinc-300 dark:bg-zinc-800 text-zinc-400 text-xs font-semibold py-3 cursor-not-allowed opacity-50" style={{ borderRadius: 'var(--border-radius-button)' }}>
                      Disabled
                    </button>
                  </div>

                  {/* 實體輸入框 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold tracking-wider opacity-75" style={{ color: 'var(--color-text)' }}>常規輸入框</span>
                      <input type="text" disabled placeholder="圓角咬合中..." className="text-xs bg-transparent border px-4 py-3 outline-none opacity-60" style={{ borderColor: 'var(--color-border)', borderRadius: 'var(--border-radius)', color: 'var(--color-text)' }} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold tracking-wider opacity-75" style={{ color: 'var(--color-text)' }}>焦點輸入框</span>
                      <input type="text" defaultValue="雙向美學連動中..." className="text-xs bg-transparent border px-4 py-3 outline-none" style={{ borderColor: 'var(--color-primary)', borderRadius: 'var(--border-radius)', color: 'var(--color-text)', borderWidth: '1.5px' }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold tracking-wider opacity-75" style={{ color: 'var(--color-text)' }}>下拉選單 (Select)</span>
                      <select 
                        className="text-xs bg-transparent border px-3 py-3 outline-none" 
                        style={{ 
                          borderColor: 'var(--color-border)', 
                          borderRadius: 'var(--border-radius)', 
                          color: 'var(--color-text)' 
                        }}
                      >
                        <option className="text-black">大廠風格 (Default)</option>
                        <option className="text-black">極客暗黑 (Geek)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold tracking-wider opacity-75" style={{ color: 'var(--color-text)' }}>單選鈕 (Radios)</span>
                      <div className="flex items-center gap-4 py-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs">
                          <input type="radio" name="story-radio" checked={selectedRadio === 'option-1'} onChange={() => setSelectedRadio('option-1')} className="text-brand-primary focus:ring-brand-primary bg-transparent" />
                          <span style={{ color: 'var(--color-text)' }}>選項 A</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold tracking-wider opacity-75" style={{ color: 'var(--color-text)' }}>開關 (Toggles)</span>
                      {/* 🚀 徹底消除硬編碼 primary-rgb 微光背景洩漏，直接使用標準變量 var(--color-border)！ */}
                      <div 
                        onClick={() => setIsToggled(!isToggled)} 
                        className="w-11 h-6 cursor-pointer relative p-0.5 transition-all duration-300" 
                        style={{ 
                          backgroundColor: isToggled ? 'var(--color-primary)' : 'var(--color-border)',
                          borderRadius: '9999px' 
                        }}
                      >
                        <div className="w-5 h-5 bg-white shadow-md transition-all duration-300" style={{ borderRadius: '9999px', transform: isToggled ? 'translateX(20px)' : 'translateX(0px)' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 📰 軌道 C. 圖文與商品卡片 */}
            {activeCategory === 'lists' && (
              <div className="space-y-6 animate-fade-in">
                <h3 className="text-xs font-bold tracking-wider opacity-60 uppercase text-left">高階 SaaS 商品訂閱與部落格大卡片</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                  {/* 部落格大卡片 */}
                  <div 
                    className="border overflow-hidden flex flex-col transition-all duration-300"
                    style={{ 
                      backgroundColor: 'var(--color-card)', 
                      borderColor: 'var(--color-border)', 
                      borderRadius: 'var(--border-radius)',
                      boxShadow: 'var(--brand-shadow)',
                      borderWidth: '1px'
                    }}
                  >
                    <div className="h-44 relative overflow-hidden">
                      <img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=600&auto=format&fit=crop" alt="Demo" className="w-full h-full object-cover" style={{ borderTopLeftRadius: 'var(--border-radius)', borderTopRightRadius: 'var(--border-radius)' }} />
                      <span className="absolute top-3 left-3 text-[9px] font-black uppercase px-2.5 py-1 text-white bg-brand-primary tracking-wider" style={{ borderRadius: 'var(--border-radius-button)' }}>AESTHETIC</span>
                    </div>
                    <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <h5 className="text-md font-bold leading-snug" style={{ color: 'var(--color-text)' }}>如何利用雙軌自適應基因一鍵出廠高級 SaaS？</h5>
                      <p className="text-xs opacity-70 leading-relaxed" style={{ color: 'var(--color-text)' }}>在美學圓角穿透與字體大一統的護航下，按鈕與卡片完美分流，釋放最純淨設計張力。</p>
                      <Link href="/auth/register" className="text-brand-primary hover:underline font-bold text-xs">閱讀全文 (Read More) →</Link>
                    </div>
                  </div>

                  {/* 定價卡片 */}
                  <div 
                    className="p-6 border backdrop-blur-md flex flex-col justify-between space-y-5 transition-all duration-300"
                    style={{ 
                      backgroundColor: 'var(--color-card)', 
                      borderColor: 'var(--color-accent)', 
                      borderRadius: 'var(--border-radius)',
                      boxShadow: 'var(--brand-shadow)',
                      borderWidth: '1.5px'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--color-accent)' }}>UNLIMITED PLAN</span>
                      <span className="text-[9px] font-bold px-2 py-0.5 border" style={{ borderRadius: 'var(--border-radius)', borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}>熱銷推薦</span>
                    </div>
                    <h5 className="text-2xl font-black text-brand-accent">$49.00 <span className="text-xs font-normal opacity-70">/ Mo</span></h5>
                    <button 
                      className="w-full text-xs font-bold py-3.5 hover:opacity-90 shadow-lg outline-none bg-brand-accent" 
                      style={{ 
                        borderRadius: 'var(--border-radius-button)',
                        color: 'var(--color-on-accent)' // 🚀 輔助色文字對比度！
                      }}
                    >
                      一鍵升級無限版
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 🗺️ 軌道 D. 導覽與佈局 (Navbar & Headers) */}
            {activeCategory === 'navigation' && (
              <div className="space-y-6 animate-fade-in">
                <h3 className="text-xs font-bold tracking-wider opacity-60 uppercase text-left">精美品牌導航列、頁尾與防撞智慧選單</h3>
                
                {/* D2. 100% 變數自適應 Mock 導覽列 */}
                <div 
                  className="p-4 border backdrop-blur-md flex items-center justify-between transition-all duration-300 relative"
                  style={{ 
                    backgroundColor: 'var(--color-card)', 
                    borderColor: 'var(--color-border)', 
                    borderRadius: 'var(--border-radius)',
                    boxShadow: 'var(--brand-shadow)',
                    borderWidth: '1px'
                  }}
                >
                  {/* Logo */}
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-brand-primary flex items-center justify-center text-[10px] font-black" style={{ borderRadius: 'var(--border-radius-button)', color: 'var(--color-on-primary)' }}>
                      P
                    </div>
                    <span className="text-xs font-black" style={{ color: 'var(--color-text)' }}>Pangu</span>
                  </div>

                  {/* 選單 */}
                  <div className="flex items-center gap-5 text-xs font-medium">
                    <span className="text-brand-primary font-bold cursor-pointer relative pb-1 border-b-2 border-brand-primary">首頁</span>
                    <span className="opacity-60 hover:opacity-100 cursor-pointer pb-1" style={{ color: 'var(--color-text)' }}>服務方案</span>
                    {/* 下拉選單觸發器 */}
                    <span 
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className="font-bold cursor-pointer pb-1 flex items-center gap-1 text-brand-primary hover:opacity-80 transition-opacity"
                    >
                      關於我們 {isDropdownOpen ? "▴" : "▾"}
                    </span>
                  </div>

                  {/* 右側按鈕 */}
                  <button 
                    className="bg-brand-primary text-[10px] font-bold px-3.5 py-2 shadow-md hover:opacity-90 transition-opacity"
                    style={{ 
                      borderRadius: 'var(--border-radius-button)',
                      color: 'var(--color-on-primary)'
                    }}
                  >
                    免費體驗
                  </button>
                </div>

                {/* 🚀 [智慧推移下拉選單] */}
                {isDropdownOpen && (
                  <div 
                    className="p-5 border text-left space-y-2.5 backdrop-blur-md animate-fade-in w-full transition-all duration-300"
                    style={{
                      backgroundColor: 'var(--color-card)',
                      borderColor: 'var(--color-border)',
                      borderRadius: 'var(--border-radius)',
                      boxShadow: 'var(--brand-shadow)',
                      borderWidth: '1px'
                    }}
                  >
                    <div className="text-[10px] font-black tracking-widest opacity-40" style={{ color: 'var(--color-text)' }}>了解盤古團隊 (Discover Us)</div>
                    <ul className="text-xs space-y-2 opacity-85 grid grid-cols-3 gap-4" style={{ color: 'var(--color-text)' }}>
                      <li className="hover:text-brand-primary cursor-pointer">✓ 矽谷大廠預設庫</li>
                      <li className="hover:text-brand-primary cursor-pointer">✓ 開發者平台故事</li>
                      <li className="hover:text-brand-primary cursor-pointer">✓ 社群優秀案例</li>
                    </ul>
                  </div>
                )}

                {/* 🚀 D3. Mock Footer */}
                <div 
                  className="p-6 border backdrop-blur-md grid grid-cols-2 sm:grid-cols-4 gap-6 text-left transition-all duration-300"
                  style={{ 
                    backgroundColor: 'var(--color-card)', 
                    borderColor: 'var(--color-border)', 
                    borderRadius: 'var(--border-radius)',
                    boxShadow: 'var(--brand-shadow)',
                    borderWidth: '1px'
                  }}
                >
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--color-text)' }}>產品服務</span>
                    <ul className="text-xs space-y-1.5 opacity-75" style={{ color: 'var(--color-text)' }}>
                      <li className="hover:text-brand-primary cursor-pointer">SaaS 控制台</li>
                      <li className="hover:text-brand-primary cursor-pointer">美學設計模組</li>
                      <li className="hover:text-brand-primary cursor-pointer">API 實時對接</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--color-text)' }}>開發資源</span>
                    <ul className="text-xs space-y-1.5 opacity-75" style={{ color: 'var(--color-text)' }}>
                      <li className="hover:text-brand-primary cursor-pointer">Swagger 文檔</li>
                      <li className="hover:text-brand-primary cursor-pointer">GitHub 倉庫</li>
                      <li className="hover:text-brand-primary cursor-pointer">樣板腳本部署</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--color-text)' }}>關於我們</span>
                    <ul className="text-xs space-y-1.5 opacity-75" style={{ color: 'var(--color-text)' }}>
                      <li className="hover:text-brand-primary cursor-pointer">團隊介紹</li>
                      <li className="hover:text-brand-primary cursor-pointer">大廠案例庫</li>
                      <li className="hover:text-brand-primary cursor-pointer">聯絡我們</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: 'var(--color-text)' }}>聯絡支援</span>
                    <ul className="text-xs space-y-1.5 opacity-75" style={{ color: 'var(--color-text)' }}>
                      <li className="hover:text-brand-primary cursor-pointer">提交問題</li>
                      <li className="hover:text-brand-primary cursor-pointer">使用條款</li>
                      <li className="hover:text-brand-primary cursor-pointer">隱私保護</li>
                    </ul>
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>
      </div>
    </>
  );
}
