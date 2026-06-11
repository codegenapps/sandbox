const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2];
  if (!url) {
    console.error('DOM_PARSER_ERROR: No URL provided.');
    process.exit(1);
  }

  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // 偽裝真實瀏覽器，防止 WAF 阻擋
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 剖析 DOM Tree 提取語意化區塊
    const sections = await page.evaluate(() => {
      // 常見的區塊特徵關鍵字
      const blockKeywords = ['hero', 'banner', 'feature', 'about', 'service', 'tab', 'pricing', 'faq', 'team', 'contact', 'footer', 'header', 'nav', 'navbar', 'menu', 'course', 'curriculum', 'overview'];
      
      const elements = Array.from(document.querySelectorAll('section, article, header, footer, nav, main, div'));
      const parsedBlocks = [];

      elements.forEach((el, index) => {
        const tagName = el.tagName.toLowerCase();
        const id = el.id || '';
        let className = el.className || '';
        if (typeof className !== 'string') className = '';

        // 判定是否為有價值的語意化大區塊
        const isSemanticTag = ['section', 'article', 'header', 'footer', 'nav', 'main'].includes(tagName);
        const hasKeywordClass = blockKeywords.some(kw => className.toLowerCase().includes(kw));
        const hasKeywordId = blockKeywords.some(kw => id.toLowerCase().includes(kw));

        // 避免重複收集父子嵌套節點 (排除細碎 div，只抓頂層特徵區塊)
        if (isSemanticTag || hasKeywordClass || hasKeywordId) {
          // 計算其深度，避免抓到太深的子 div
          let depth = 0;
          let parent = el.parentElement;
          while (parent) {
            depth++;
            parent = parent.parentElement;
          }

          // 限制只收集特徵明顯的頂層區塊
          if (depth < 6) {
            // 抓取區塊內的標題作為語意描述
            const hEl = el.querySelector('h1, h2, h3, h4');
            const sectionTitle = hEl ? hEl.innerText.trim().replace(/\s+/g, ' ').substring(0, 40) : '';

            // 抓取文字摘要
            const elText = el.innerText ? el.innerText.trim().replace(/\s+/g, ' ').substring(0, 100) : '';

            parsedBlocks.push({
              index: index,
              tag: tagName,
              id: id,
              className: className.split(' ').filter(c => c.trim() !== '').slice(0, 5).join(' '), // 僅保留前5個 class
              title: sectionTitle,
              summary: elText,
              depth: depth
            });
          }
        }
      });

      // 智慧去重：如果父節點和子節點都被收集了，且它們的範圍重合度極高，優先保留頂層大節點
      return parsedBlocks.filter((block, idx, self) => {
        // 如果有其他區塊與它深度更淺且 className/id 高度相似，過濾之
        return !self.some(other => other.depth < block.depth && other.title === block.title && block.title !== '');
      }).slice(0, 15); // 最多保留 15 個核心區塊
    });

    // 輸出結構化 JSON
    console.log(JSON.stringify({ status: 'success', url: url, sections: sections }, null, 2));
    await browser.close();
  } catch (error) {
    console.error('DOM_PARSER_ERROR:', error.message);
    process.exit(1);
  }
})();
