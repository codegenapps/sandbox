import { Html, Head, Main, NextScript } from 'next/document';
import Script from 'next/script';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* 💡 使用 beforeInteractive 策略，腳本會被注入到伺服器產出的 HTML Head 裡 */}
        <Script
          src="/cga-inspector.js"
          strategy="beforeInteractive"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
