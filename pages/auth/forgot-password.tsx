import React, { useState } from 'react';
import Head from 'next/head';
import { Card, CardBody, Input, Button } from '@nextui-org/react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`密碼重設郵件已發送至: ${email}`);
  };

  return (
    <>
      <Head>
        <title>重設密碼 | Pangu Sandbox</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-brand-surface p-4 text-brand-text">
        <Card className="w-full max-w-md shadow-lg border border-default-100 bg-white/70 backdrop-blur-md">
          <CardBody className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-brand-text">忘記密碼？</h2>
              <p className="text-sm text-default-500 font-normal">請輸入您的註冊信箱，我們將向您發送密碼重設連結</p>
            </div>

            <form onSubmit={handleReset} className="space-y-4">
              <Input
                type="email"
                label="註冊電子郵件"
                placeholder="you@example.com"
                labelPlacement="outside"
                variant="bordered"
                value={email}
                onValueChange={setEmail}
                required
                classNames={{
                  inputWrapper: "border-brand-primary/30 hover:border-brand-primary focus-within:!border-brand-primary"
                }}
              />

              <Button
                type="submit"
                className="w-full bg-brand-primary text-white font-semibold py-6 rounded-xl hover:opacity-90 shadow-md transition-opacity"
              >
                發送重設郵件
              </Button>
            </form>

            <div className="text-center text-sm">
              <Link href="/auth/login" className="text-brand-primary hover:underline font-semibold flex items-center justify-center gap-1">
                ← 返回登入會員
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
