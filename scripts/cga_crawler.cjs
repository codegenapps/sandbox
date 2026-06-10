const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    // 偽裝真實瀏覽器指紋，突破 WAF 與 Cloudflare 防爬蟲攔截 (403 Forbidden)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    });
    
    // 從命令列參數中獲取目標網址
    await page.goto(process.argv[2], { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // 提取網頁純文字，過濾掉 script 與 style 等非內容標籤
    const text = await page.evaluate(() => {
      const elementsToRemove = document.querySelectorAll('script, style, noscript, iframe, svg');
      elementsToRemove.forEach(el => el.remove());
      return document.body.innerText;
    });
    
    console.log(text);
    await browser.close();
  } catch (error) {
    console.error('CRAWLER_ERROR:', error.message);
    process.exit(1);
  }
})();
