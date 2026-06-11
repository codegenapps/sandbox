import React, { useState } from 'react';
import Head from 'next/head';
import { Card, CardBody, Input, Button, Checkbox } from '@nextui-org/react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`正在會員登入: ${email}`);
  };

  return (
    <>
      <Head>
        <title>會員登入 | Pangu Sandbox</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-brand-surface p-4 text-brand-text">
        <Card className="w-full max-w-md shadow-lg border border-default-100 bg-white/70 backdrop-blur-md">
          <CardBody className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-brand-text">歡迎回來</h2>
              <p className="text-sm text-default-500">請輸入您的電子郵件與密碼登入會員</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="email"
                label="電子郵件"
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
              <Input
                type="password"
                label="密碼"
                placeholder="請輸入密碼"
                labelPlacement="outside"
                variant="bordered"
                value={password}
                onValueChange={setPassword}
                required
                classNames={{
                  inputWrapper: "border-brand-primary/30 hover:border-brand-primary focus-within:!border-brand-primary"
                }}
              />

              <div className="flex items-center justify-between text-sm">
                <Checkbox defaultSelected size="sm" classNames={{ label: "text-brand-text", icon: "text-white bg-brand-primary border-brand-primary" }}>
                  記住我
                </Checkbox>
                <Link href="/auth/forgot-password" className="text-brand-primary hover:underline font-medium">
                  忘記密碼？
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full bg-brand-primary text-white font-semibold py-6 rounded-xl hover:opacity-90 shadow-md transition-opacity"
              >
                登入會員
              </Button>
            </form>

            <div className="text-center text-sm text-default-500">
              還沒有帳號嗎？{' '}
              <Link href="/auth/register" className="text-brand-primary hover:underline font-semibold">
                免費註冊
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
