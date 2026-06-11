import React, { useState } from 'react';
import Head from 'next/head';
import { Card, CardBody, Input, Button, Checkbox } from '@nextui-org/react';
import Link from 'next/link';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) {
      alert('請先閱讀並同意服務條款');
      return;
    }
    alert(`註冊會員: ${name} (${email})`);
  };

  return (
    <>
      <Head>
        <title>免費註冊 | Pangu Sandbox</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-brand-surface p-4 text-brand-text">
        <Card className="w-full max-w-md shadow-lg border border-default-100 bg-white/70 backdrop-blur-md">
          <CardBody className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-brand-text">創立新帳號</h2>
              <p className="text-sm text-default-500">立即加入，開啟您的美學與教育探索之旅</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <Input
                type="text"
                label="真實姓名"
                placeholder="請輸入您的姓名"
                labelPlacement="outside"
                variant="bordered"
                value={name}
                onValueChange={setName}
                required
                classNames={{
                  inputWrapper: "border-brand-primary/30 hover:border-brand-primary focus-within:!border-brand-primary"
                }}
              />
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
                label="設定密碼"
                placeholder="請設定至少 6 位數密碼"
                labelPlacement="outside"
                variant="bordered"
                value={password}
                onValueChange={setPassword}
                required
                classNames={{
                  inputWrapper: "border-brand-primary/30 hover:border-brand-primary focus-within:!border-brand-primary"
                }}
              />

              <Checkbox 
                isSelected={agree} 
                onValueChange={setAgree}
                size="sm" 
                classNames={{ label: "text-brand-text text-xs", icon: "text-white bg-brand-primary border-brand-primary" }}
              >
                我已閱讀並同意使用條款與隱私權保護政策
              </Checkbox>

              <Button
                type="submit"
                className="w-full bg-brand-primary text-white font-semibold py-6 rounded-xl hover:opacity-90 shadow-md transition-opacity"
              >
                免費註冊帳號
              </Button>
            </form>

            <div className="text-center text-sm text-default-500">
              已經有帳號了？{' '}
              <Link href="/auth/login" className="text-brand-primary hover:underline font-semibold">
                登入會員
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
