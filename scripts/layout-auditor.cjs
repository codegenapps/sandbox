const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'http://localhost:3000';
  console.log(`>>> Starting真機 DOM 排版審計 (DOM Boundary Auditor) on: ${url}`);

  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // 設定常用響應式尺寸 (手機端、電腦端雙重驗收)
    const viewports = [
      { width: 375, height: 812, name: 'Mobile (RWD)' },
      { width: 1440, height: 900, name: 'Desktop (1440p)' }
    ];

    const allErrors = [];

    for (const vp of viewports) {
      await page.setViewport(vp);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

      // 在頁面環境內執行物理測量
      const errors = await page.evaluate((vpName) => {
        const layoutErrors = [];

        // 🛡️ 0. 檢測 Next.js / Vite 伺服器編譯致命錯誤 (Compilation / Build Errors)
        const bodyText = document.body ? (document.body.innerText || "") : "";
        const pageTitle = document.title || "";
        const isNextJsErrorOverlay = !!document.querySelector('nextjs-portal') || !!document.querySelector('#nextjs__container_build_error_label') || !!document.querySelector('.nextjs-toast-errors-parent');
        const isCompileError = bodyText.includes("Failed to compile") || bodyText.includes("Build Error") || bodyText.includes("Module not found") || pageTitle.includes("Build Error") || isNextJsErrorOverlay;

        if (isCompileError) {
          layoutErrors.push({
            viewport: vpName,
            type: 'COMPILATION_ERROR',
            element: 'Web Server Compiler',
            reason: `網頁編譯失敗！控制台顯示致命編譯錯誤或缺少依賴模組。錯誤詳情：${bodyText.slice(0, 400).replace(/\n/g, ' ')}`
          });
          return layoutErrors; // 優先中斷並返回編譯錯誤
        }

        const elements = Array.from(document.querySelectorAll('body *'));

        // 🛡️ 1. 檢測 RWD 橫向溢出 (Overflow Guard)
        elements.forEach(el => {
          const rect = el.getBoundingClientRect();
          const tagName = el.tagName.toLowerCase();
          let className = el.className || '';
          if (typeof className !== 'string') className = '';

          // 排除不需要測量的特殊/系統/隱藏標籤
          if (['script', 'style', 'noscript', 'svg', 'iframe', 'path'].includes(tagName)) return;
          if (rect.width === 0 || rect.height === 0) return;

          // 橫向右側溢出
          if (rect.right > window.innerWidth + 1) { // 寬容 1px 誤差
            layoutErrors.push({
              viewport: vpName,
              type: 'HORIZONTAL_OVERFLOW',
              element: `<${tagName} class="${className.split(' ').slice(0, 3).join(' ')}">`,
              reason: `元素寬度超出了視窗右邊界 (右邊界: ${Math.round(rect.right)}px, 視窗寬度: ${window.innerWidth}px)。這會產生不專業的橫向捲軸！`
            });
          }

          // 🛡️ 2. 檢測高度塌陷 (Height Collapse Guard)
          // 如果容器內有可見的子元素，但容器自己高度卻為 0
          if (rect.height === 0 && el.children.length > 0) {
            const hasVisibleChild = Array.from(el.children).some(child => {
              const cRect = child.getBoundingClientRect();
              return cRect.height > 0 && cRect.width > 0;
            });
            if (hasVisibleChild) {
              layoutErrors.push({
                viewport: vpName,
                type: 'HEIGHT_COLLAPSE',
                element: `<${tagName} class="${className.split(' ').slice(0, 3).join(' ')}">`,
                reason: `容器高度塌陷為 0px，但內部包含可見的子元素。這會導致佈局擠壓或內容隱形！`
              });
            }
          }
        });

        // 🛡️ 3. 檢測嚴重重疊碰撞 (Overlap Collision Guard)
        // 僅對重要的容器元素（如 section, div.card, form, input）進行兩兩碰撞檢測
        const containers = elements.filter(el => {
          const tag = el.tagName.toLowerCase();
          let className = el.className || '';
          if (typeof className !== 'string') className = '';
          return ['section', 'form', 'main'].includes(tag) || className.includes('card') || className.includes('panel');
        });

        for (let i = 0; i < containers.length; i++) {
          for (let j = i + 1; j < containers.length; j++) {
            const elA = containers[i];
            const elB = containers[j];

            // 排除父子關係的重疊
            if (elA.contains(elB) || elB.contains(elA)) continue;

            const rectA = elA.getBoundingClientRect();
            const rectB = elB.getBoundingClientRect();

            // 判斷是否發生交集 (重疊)
            const isOverlap = !(
              rectA.right < rectB.left + 5 || 
              rectA.left > rectB.right - 5 || 
              rectA.bottom < rectB.top + 5 || 
              rectA.top > rectB.bottom - 5
            );

            if (isOverlap) {
              const tagA = elA.tagName.toLowerCase();
              const tagB = elB.tagName.toLowerCase();
              layoutErrors.push({
                viewport: vpName,
                type: 'OVERLAP_COLLISION',
                element: `<${tagA}> 與 <${tagB}>`,
                reason: `這兩個元件在畫面上發生了重疊碰撞（A底邊: ${Math.round(rectA.bottom)}px, B頂邊: ${Math.round(rectB.top)}px）。這會導致排版被遮擋或嚴重擠壓！`
              });
            }
          }
        }

        return layoutErrors;
      }, vp.name);

      allErrors.push(...errors);
    }

    const hasErrors = allErrors.length > 0;
    const finalResult = {
      status: hasErrors ? 'FAILED' : 'SUCCESS',
      url: url,
      errors_count: allErrors.length,
      errors: allErrors
    };

    console.log(JSON.stringify(finalResult, null, 2));
    await browser.close();
    process.exit(hasErrors ? 0 : 0); // 正常退出，由 Go 解析狀態
  } catch (error) {
    console.error('AUDITOR_CRASH:', error.message);
    process.exit(1);
  }
})();
