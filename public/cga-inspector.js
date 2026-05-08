if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    document.body.addEventListener('click', (e) => {
      if (e.altKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target;
        
        let exactPath = null;

        // 💡 1. 尋找身上或父層帶有 data-cga-path 的元素 (Next.js 注入)
        const sourceElement = target.closest('[data-cga-path]');
        if (sourceElement) {
            exactPath = sourceElement.getAttribute('data-cga-path');
        }

        // 💡 2. Vite / React DevTools 內建屬性尋找 (透過 Fiber Tree)
        if (!exactPath) {
            // React 18+ 內部屬性通常以 __reactFiber$ 開頭
            const fiberKey = Object.keys(target).find(key => key.startsWith('__reactFiber$'));
            if (fiberKey) {
                let fiberNode = target[fiberKey];
                // 往上找直到找到帶有 _debugSource 的節點
                while (fiberNode && !exactPath) {
                    if (fiberNode._debugSource && fiberNode._debugSource.fileName) {
                        const fileName = fiberNode._debugSource.fileName;
                        // 過濾掉 node_modules 內部的組件，只抓取 src/ 或 app/ 等使用者代碼
                        if (!fileName.includes('node_modules')) {
                            // 擷取專案內的相對路徑 (假設 Vite 專案根目錄特徵)
                            const rootIndex = fileName.indexOf('/src/');
                            if (rootIndex !== -1) {
                                exactPath = fileName.substring(rootIndex);
                            } else {
                                const appIndex = fileName.indexOf('/app/');
                                if (appIndex !== -1) {
                                    exactPath = fileName.substring(appIndex);
                                }
                            }
                        }
                    }
                    fiberNode = fiberNode.return;
                }
            }
        }
        
        // 💡 3. 降級方案：如果都沒抓到精準路徑，退回使用網址推測
        const resolvedPath = exactPath || window.location.pathname;

        const tag = target.tagName.toLowerCase();
        let className = target.className;
        if (typeof className !== 'string') className = '';
        const text = target.innerText ? target.innerText.substring(0, 30) : '';
        let info = '<' + tag;
        if (className) info += ' class="' + className + '"';
        info += '>';
        if (text) info += text + '</' + tag + '>';
        
        window.parent.postMessage({ 
            type: 'CGA_ELEMENT_SELECTED', 
            path: resolvedPath, // 💡 使用解析後的最精準路徑
            element: info 
        }, '*');
        
        target.style.outline = '3px solid #3b82f6';
        target.style.outlineOffset = '2px';
        setTimeout(() => { target.style.outline = ''; target.style.outlineOffset = ''; }, 1000);
      }
    }, true);
  });
}