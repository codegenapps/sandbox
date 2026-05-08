if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    console.log("[CGA Inspector] Active and monitoring...");
    document.body.addEventListener('click', (e) => {
      if (e.altKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target;
        
        console.log("[CGA Inspector] Clicked element:", target);
        
        let exactPath = null;

        // 💡 1. 尋找身上或父層帶有 data-cga-path 的元素 (Next.js 注入)
        const sourceElement = target.closest('[data-cga-path]');
        if (sourceElement) {
            exactPath = sourceElement.getAttribute('data-cga-path');
            console.log("[CGA Inspector] Found data-cga-path:", exactPath);
        } else {
            console.log("[CGA Inspector] No data-cga-path found on element or ancestors.");
        }

        // 💡 2. Vite / React DevTools 內建屬性尋找 (透過 Fiber Tree)
        if (!exactPath) {
            // ... (rest of Fiber logic)
            const fiberKey = Object.keys(target).find(key => key.startsWith('__reactFiber$'));
            if (fiberKey) {
                console.log("[CGA Inspector] Inspecting React Fiber Tree...");
                let fiberNode = target[fiberKey];
                while (fiberNode && !exactPath) {
                    if (fiberNode._debugSource && fiberNode._debugSource.fileName) {
                        const fileName = fiberNode._debugSource.fileName;
                        if (!fileName.includes('node_modules')) {
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
                if (exactPath) console.log("[CGA Inspector] Found path via Fiber:", exactPath);
            }
        }
        
        const resolvedPath = exactPath || window.location.pathname;
        console.log("[CGA Inspector] Resolved final path:", resolvedPath);

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
            path: resolvedPath,
            element: info 
        }, '*');
        
        target.style.outline = '3px solid #3b82f6';
        target.style.outlineOffset = '2px';
        setTimeout(() => { target.style.outline = ''; target.style.outlineOffset = ''; }, 1000);
      }
    }, true);
  });
}