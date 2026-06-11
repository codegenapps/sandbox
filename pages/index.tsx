import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Button } from '@nextui-org/react';

export default function Home() {
  return (
    <>
      <Head>
        <title>Pangu Sandbox | Ready for AIGC Creation</title>
      </Head>
      <div className="flex flex-col items-center justify-center min-h-[85vh] bg-brand-surface text-brand-text p-4">
        <div className="text-center space-y-6 max-w-lg">
          {/* 🚀 CGA 呼吸燈：100% 自適應品牌主色與邊框，一鍵秒換膚！ */}
          <div className="w-20 h-20 bg-brand-primary/10 border-2 border-brand-primary rounded-2xl mx-auto flex items-center justify-center animate-pulse shadow-md">
            <span className="font-black italic text-brand-primary text-xl">CGA</span>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-brand-text">Pangu Sandbox Ready</h1>
            <p className="text-sm text-default-500 font-normal">
              盤古樣板已成功就位。這是一個支援全局主題變數與 100% 響應式佈局的工業級 AI 創造底座。
            </p>
          </div>

          {/* 出廠自帶的認證 Review 跳轉按鈕，點擊直達 high-signal 測試 */}
          <div className="flex justify-center gap-4 pt-2">
            <Button 
              as={Link}
              href="/auth/login"
              className="bg-brand-primary text-white font-semibold px-6 py-4 rounded-xl shadow-md hover:opacity-90 transition-opacity"
            >
              Review 會員登入
            </Button>
            <Button 
              as={Link}
              href="/auth/register"
              variant="bordered"
              className="border-brand-primary text-brand-primary font-semibold px-6 py-4 rounded-xl hover:bg-brand-primary/5 transition-colors"
            >
              Review 免費註冊
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
