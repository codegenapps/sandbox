if (typeof window !== 'undefined') {
  window.__cgaDraggingApi = null;
  window.__cgaLastHighlighted = null;

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

  // 💡 改用 html-to-image 以支援現代 CSS (oklab, oklch)
  const captureThumbnail = async () => {
      if (typeof window.htmlToImage === 'undefined') {
          console.log("[CGA Inspector] Loading html-to-image for screenshot...");
          try {
              await new Promise((resolve, reject) => {
                  const script = document.createElement('script');
                  script.src = "https://unpkg.com/html-to-image@1.11.11/dist/html-to-image.js";
                  script.onload = () => {
                      console.log("[CGA Inspector] html-to-image loaded successfully.");
                      resolve();
                  };
                  script.onerror = () => {
                      console.error("[CGA Inspector] Failed to load html-to-image script.");
                      reject(new Error("Script load failed"));
                  };
                  document.head.appendChild(script);
              });
          } catch (e) {
              return null;
          }
      }

      console.log("[CGA Inspector] Disabling cross-origin stylesheets...");
      // 💡 終極防禦：暫時「癱瘓」所有跨域的 CSS，防止套件底層去讀取 cssRules 導致崩潰
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      const disabledLinks = [];
      
      links.forEach(link => {
          if (link.href && !link.href.startsWith(window.location.origin)) {
              const originalHref = link.href;
              disabledLinks.push({ el: link, href: originalHref });
              link.removeAttribute('href'); 
          }
      });

      try {
          console.log("[CGA Inspector] Starting toJpeg rendering...");
          // html-to-image 直接輸出 Base64 JPEG
          const dataUrl = await window.htmlToImage.toJpeg(document.body, { 
              quality: 0.5,
              backgroundColor: '#000',
              // 縮小尺寸以節省容量
              width: document.body.offsetWidth,
              height: document.body.offsetHeight,
              style: {
                  transform: 'scale(0.5)',
                  transformOrigin: 'top left'
              },
              // 放寬過濾條件，強制過濾所有 iframe 或奇怪的節點
              filter: (node) => {
                 if (node.tagName === 'IFRAME') return false;
                 return true;
              }
          });
          console.log("[CGA Inspector] Rendering complete. Base64 length:", dataUrl.length);
          return dataUrl;
      } catch (e) {
          console.error("[CGA Inspector] Screenshot failed:", e);
          return null;
      } finally {
          console.log("[CGA Inspector] Restoring stylesheets...");
          // 💡 恢復原狀
          disabledLinks.forEach(({ el, href }) => {
              el.setAttribute('href', href);
          });
      }
  };

  window.addEventListener('message', async (event) => {
    if (event.data?.type === 'CGA_SET_DRAG_API') {
      window.__cgaDraggingApi = event.data.api;
    } else if (event.data?.type === 'CGA_CLEAR_DRAG_API') {
      window.__cgaDraggingApi = null;
      clearHighlight();
    } else if (event.data?.type === 'CGA_TAKE_SCREENSHOT') {
      console.log("[CGA Inspector] Internal capture requested...");
      const base64 = await captureThumbnail();
      window.parent.postMessage({ type: 'CGA_SCREENSHOT_TAKEN', base64 }, '*');
    } else if (event.data?.type === 'CGA_INTERNAL_DRAG_OVER') {
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
        const dragData = window.__cgaDraggingApi;
        const resolvedPath = resolveExactPath(target);
        const info = getElementInfo(target);
        window.parent.postMessage({ type: 'CGA_API_DROPPED', path: resolvedPath, element: info, api: dragData }, '*');
      }
      clearHighlight();
      window.__cgaDraggingApi = null;
    }
  });

  window.addEventListener('load', () => {
    console.log("[CGA Inspector] Active (with Modern Screenshot Support)...");
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
