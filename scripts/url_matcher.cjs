const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const targetUrl = process.argv[2];
if (!targetUrl) {
  console.error("Usage: node url_matcher.cjs <url>");
  process.exit(1);
}

(async () => {
  try {
    console.log('>>> [URL Matcher] Launching browser for URL visual extraction...');
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // A. 🚀 提取網頁語意文字 (用來搜尋匹配大師 Preset)
    const metaData = await page.evaluate(() => {
      const title = document.title || '';
      const descEl = document.querySelector('meta[name="description"]');
      const desc = descEl ? descEl.getAttribute('content') : '';
      const keysEl = document.querySelector('meta[name="keywords"]');
      const keys = keysEl ? keysEl.getAttribute('content') : '';
      
      return `${title} ${desc} ${keys}`;
    });

    // B. 🚀 實時吸取網站真實色彩與圓角
    const colors = await page.evaluate(() => {
      const rgbToHex = (rgb) => {
        if (!rgb || rgb === 'transparent' || rgb.includes('rgba(0, 0, 0, 0)')) return null;
        const matches = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!matches) {
          const rgbaMatches = rgb.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
          if (rgbaMatches && parseFloat(rgbaMatches[4]) === 0) return null;
          if (rgbaMatches) {
            return "#" + rgbaMatches.slice(1, 4).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
          }
          return null;
        }
        return "#" + matches.slice(1).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
      };

      const colorMap = {};
      const addColor = (hex) => {
        if (hex && hex !== '#ffffff' && hex !== '#000000') {
          colorMap[hex] = (colorMap[hex] || 0) + 1;
        }
      };

      // 吸取按鈕與連結色彩
      const buttons = document.querySelectorAll('button, a, [role="button"]');
      buttons.forEach(btn => {
        try {
          const style = window.getComputedStyle(btn);
          addColor(rgbToHex(style.backgroundColor));
          addColor(rgbToHex(style.color));
        } catch(e){}
      });

      const sorted = Object.keys(colorMap).sort((a, b) => colorMap[b] - colorMap[a]);
      const primary = sorted[0] || '#4A6B53';
      const accent = sorted[1] || '#D4AF37';

      // 提取 body 背景色
      let surface = '#FBF9F6';
      try {
        const bodyBg = rgbToHex(window.getComputedStyle(document.body).backgroundColor);
        if (bodyBg && bodyBg !== '#ffffff' && bodyBg !== '#000000') {
          surface = bodyBg;
        }
      } catch (e) {}

      return { primary, surface, accent };
    });

    await browser.close();

    // C. 🚀 將吸取到的語意文字，傳遞給 search_presets.py 計算最優 Top 3!
    const cleanMeta = metaData.replace(/'/g, "").substring(0, 200); // 防範注入
    const searchCmd = `python3 /home/user/.cga/scripts/search_presets.py '${cleanMeta}'`;
    const searchRes = execSync(searchCmd, { encoding: 'utf-8' }).trim();
    
    const presets = JSON.parse(searchRes);

    // D. 輸出標準二合一合約 JSON，給前端 React 動態點選！
    const output = {
      presets,
      colors
    };

    console.log(`URL_MATCH_SUCCESS:${JSON.stringify(output)}`);
  } catch (error) {
    console.error('URL_MATCHER_ERROR:', error.message);
    process.exit(1);
  }
})();
