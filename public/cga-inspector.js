if (typeof window !== 'undefined') {
  window.__cgaDraggingApi = null;
  window.__cgaLastHighlighted = null; // 💡 追蹤上一個亮起的元件

  const clearHighlight = () => {
    if (window.__cgaLastHighlighted) {
      window.__cgaLastHighlighted.style.outline = '';
      window.__cgaLastHighlighted.style.outlineOffset = '';
      window.__cgaLastHighlighted.style.backgroundColor = '';
      window.__cgaLastHighlighted = null;
    }
  };

  const resolveExactPath = (target) => {
      if (!target) return window.location.pathname;
      let exactPath = target.closest('[data-cga-path]')?.getAttribute('data-cga-path');
      if (!exactPath) {
          const fiberKey = Object.keys(target).find(key => key.startsWith('__reactFiber$'));
          if (fiberKey) {
              let fiberNode = target[fiberKey];
              while (fiberNode && !exactPath) {
                  if (fiberNode._debugSource && fiberNode._debugSource.fileName) {
                      const fileName = fiberNode._debugSource.fileName;
                      if (!fileName.includes('node_modules')) {
                          const rootIndex = fileName.indexOf('/src/') !== -1 ? fileName.indexOf('/src/') : fileName.indexOf('/app/');
                          if (rootIndex !== -1) exactPath = fileName.substring(rootIndex);
                      }
                  }
                  fiberNode = fiberNode.return;
              }
          }
      }
      return exactPath || window.location.pathname;
  };

  const getElementInfo = (target) => {
      if (!target) return "";
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

  // 💡 動態載入 html2canvas 以節省頻寬，僅在截圖時下載
  const captureThumbnail = async () => {
      if (typeof html2canvas === 'undefined') {
          console.log("[CGA Inspector] Loading html2canvas for screenshot...");
          await new Promise((resolve) => {
              const script = document.createElement('script');
              script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
              script.onload = resolve;
              document.head.appendChild(script);
          });
      }

      try {
          const canvas = await html2canvas(document.body, {
              scale: 0.5, // 初始降採樣
              useCORS: true,
              backgroundColor: '#000',
              logging: false
          });

          // 進一步縮放與壓縮
          const resizedCanvas = document.createElement('canvas');
          const ctx = resizedCanvas.getContext('2d');
          const maxWidth = 400;
          const scale = Math.min(maxWidth / canvas.width, 1);
          resizedCanvas.width = canvas.width * scale;
          resizedCanvas.height = canvas.height * scale;
          ctx.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height);
          
          return resizedCanvas.toDataURL('image/jpeg', 0.5); // 低品質 JPEG
      } catch (e) {
          console.error("[CGA Inspector] Screenshot failed:", e);
          return null;
      }
  };

  window.addEventListener('message', async (event) => {
    if (event.data?.type === 'CGA_SET_DRAG_API') {
      console.log("[CGA Inspector] Received API for Drag:", event.data.api);
      window.__cgaDraggingApi = event.data.api;
    } else if (event.data?.type === 'CGA_CLEAR_DRAG_API') {
      window.__cgaDraggingApi = null;
      clearHighlight();
    } else if (event.data?.type === 'CGA_TAKE_SCREENSHOT') {
      console.log("[CGA Inspector] Internal capture requested...");
      const base64 = await captureThumbnail();
      window.parent.postMessage({ type: 'CGA_SCREENSHOT_TAKEN', base64 }, '*');
    } else if (event.data?.type === 'CGA_INTERNAL_DRAG_OVER') {
      // 💡 核心魔法：根據父視窗傳來的座標，找到 iframe 內部的元素
      const target = document.elementFromPoint(event.data.x, event.data.y);
      if (target && target !== window.__cgaLastHighlighted) {
        clearHighlight();
        target.style.outline = '2px dashed #a855f7';
        target.style.outlineOffset = '2px';
        target.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
        window.__cgaLastHighlighted = target;
      }
    } else if (event.data?.type === 'CGA_INTERNAL_DRAG_LEAVE') {
      clearHighlight();
    } else if (event.data?.type === 'CGA_INTERNAL_DROP') {
      const target = document.elementFromPoint(event.data.x, event.data.y);
      if (target && window.__cgaDraggingApi) {
        console.log("[CGA Inspector] Internal Drop detected on:", target.tagName);
        const dragData = window.__cgaDraggingApi;
        const resolvedPath = resolveExactPath(target);
        const info = getElementInfo(target);

        window.parent.postMessage({ 
            type: 'CGA_API_DROPPED', 
            path: resolvedPath,
            element: info,
            api: dragData
        }, '*');
      }
      clearHighlight();
      window.__cgaDraggingApi = null;
    }
  });

  window.addEventListener('load', () => {
    console.log("[CGA Inspector] Active and monitoring (with Shield-Overlay & Screenshot Support)...");

    // 💡 點擊選取邏輯 (Click-to-Prompt)
    document.addEventListener('click', (e) => {
      if (e.altKey || e.metaKey) {
        e.preventDefault(); e.stopPropagation();
        const target = e.target;
        window.parent.postMessage({ type: 'CGA_ELEMENT_SELECTED', path: resolveExactPath(target), element: getElementInfo(target) }, '*');
        target.style.outline = '3px solid #3b82f6';
        target.style.outlineOffset = '2px';
        setTimeout(() => { target.style.outline = ''; target.style.outlineOffset = ''; }, 1000);
      }
    }, true);
  });
}
