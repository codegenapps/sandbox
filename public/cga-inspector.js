if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    console.log("[CGA Inspector] Active and monitoring...");

    // 共用的精準路徑尋找邏輯
    const resolveExactPath = (target) => {
        let exactPath = null;
        
        // 1. Next.js Babel 注入
        const sourceElement = target.closest('[data-cga-path]');
        if (sourceElement) {
            exactPath = sourceElement.getAttribute('data-cga-path');
        }

        // 2. Vite Fiber 尋找
        if (!exactPath) {
            const fiberKey = Object.keys(target).find(key => key.startsWith('__reactFiber$'));
            if (fiberKey) {
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
            }
        }
        return exactPath || window.location.pathname;
    };

    const getElementInfo = (target) => {
        const tag = target.tagName.toLowerCase();
        let className = target.className;
        if (typeof className !== 'string') className = '';
        const text = target.innerText ? target.innerText.substring(0, 30) : '';
        let info = '<' + tag;
        if (className) info += ' class="' + className + '"';
        info += '>';
        if (text) info += text + '</' + tag + '>';
        return info;
    };

    // 💡 點擊選取邏輯 (Click-to-Prompt)
    document.body.addEventListener('click', (e) => {
      if (e.altKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        const target = e.target;
        const resolvedPath = resolveExactPath(target);
        const info = getElementInfo(target);
        
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

    // 💡 拖曳 API 邏輯 (Drag-to-API)
    document.body.addEventListener('dragover', (e) => {
        e.preventDefault(); // 必須阻止預設行為才能允許 drop
        e.target.style.outline = '2px dashed #a855f7'; // Purple outline for drag
        e.target.style.outlineOffset = '2px';
        e.target.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
    });

    document.body.addEventListener('dragleave', (e) => {
        e.target.style.outline = '';
        e.target.style.outlineOffset = '';
        e.target.style.backgroundColor = '';
    });

    document.body.addEventListener('drop', (e) => {
        e.preventDefault();
        e.target.style.outline = '';
        e.target.style.outlineOffset = '';
        e.target.style.backgroundColor = '';

        try {
            // 解析拖曳過來的 API 資料
            const dragDataStr = e.dataTransfer.getData('application/json');
            if (!dragDataStr) return;
            
            const dragData = JSON.parse(dragDataStr);
            if (dragData.type === 'CGA_API_DRAG') {
                const target = e.target;
                const resolvedPath = resolveExactPath(target);
                const info = getElementInfo(target);

                window.parent.postMessage({ 
                    type: 'CGA_API_DROPPED', 
                    path: resolvedPath,
                    element: info,
                    api: dragData
                }, '*');
                
                target.style.outline = '3px solid #a855f7';
                target.style.outlineOffset = '2px';
                setTimeout(() => { target.style.outline = ''; target.style.outlineOffset = ''; }, 1000);
            }
        } catch (err) {
            console.error("[CGA Inspector] Drop Error:", err);
        }
    });

  });
}