if (typeof window !== 'undefined') {
  // 💡 攔截並轉發 Console 訊息給主控台
  if (!window.__cgaConsoleHooked) {
      window.__cgaConsoleHooked = true;
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;

      const serializeArgs = (args) => {
          return args.map(arg => {
              if (arg === null) return 'null';
              if (arg === undefined) return 'undefined';
              if (typeof arg === 'object') {
                  try { return JSON.stringify(arg); } catch(e) { return '[Circular Object]'; }
              }
              return String(arg);
          }).join(' ');
      };

      console.log = (...args) => {
          if (!args[0]?.includes?.('[CGA Inspector]')) {
              window.parent.postMessage({ type: 'CGA_CONSOLE_LOG', level: 'info', payload: serializeArgs(args) }, '*');
          }
          originalLog(...args);
      };
      console.warn = (...args) => {
          window.parent.postMessage({ type: 'CGA_CONSOLE_LOG', level: 'warn', payload: serializeArgs(args) }, '*');
          originalWarn(...args);
      };
      console.error = (...args) => {
          window.parent.postMessage({ type: 'CGA_CONSOLE_LOG', level: 'error', payload: serializeArgs(args) }, '*');
          originalError(...args);
      };

      // 💡 監聽網址變化 (解決問題 1：網址列同步)
      const notifyRouteChanged = () => {
          window.parent.postMessage({ 
              type: 'CGA_ROUTE_CHANGED', 
              path: window.location.pathname + window.location.search 
          }, '*');
      };

      const originalPushState = window.history.pushState;
      window.history.pushState = function(...args) {
          originalPushState.apply(this, args);
          notifyRouteChanged();
      };

      const originalReplaceState = window.history.replaceState;
      window.history.replaceState = function(...args) {
          originalReplaceState.apply(this, args);
          notifyRouteChanged();
      };

      window.addEventListener('popstate', notifyRouteChanged);
  }

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
      
      const id = target.id || '';
      const name = target.getAttribute('name') || '';
      
      // 💡 提取精簡內文作為特徵 (移除換行，限制長度)
      let text = (target.innerText || '').replace(/\n/g, ' ').trim();
      if (text.length > 50) text = text.substring(0, 50) + '...';
      
      let info = '<' + tag;
      if (id) info += ' id="' + id + '"';
      if (name) info += ' name="' + name + '"';
      if (className) info += ' class="' + className + '"';
      info += '>';
      if (text) info += text + '</' + tag + '>';
      return info;
  };

  // 💡 高品質智慧截圖模式
  const captureThumbnail = async () => {
      if (typeof window.htmlToImage === 'undefined') {
          console.log("[CGA Inspector] Loading html-to-image...");
          try {
              await new Promise((resolve, reject) => {
                  const script = document.createElement('script');
                  script.src = "https://unpkg.com/html-to-image@1.11.11/dist/html-to-image.js";
                  script.onload = resolve;
                  script.onerror = reject;
                  document.head.appendChild(script);
              });
          } catch (e) { return null; }
      }

      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      const disabledLinks = [];
      links.forEach(link => {
          if (link.href && !link.href.startsWith(window.location.origin)) {
              const originalHref = link.href;
              disabledLinks.push({ el: link, href: originalHref });
              link.removeAttribute('href'); 
          }
      });

      // 💡 決定要拍哪裡：優先拍 React 根節點，避開無關的系統節點
      const targetEl = document.getElementById('root') || document.getElementById('__next') || document.body;

      try {
          console.log("[CGA Inspector] Starting rendering for target:", targetEl.tagName);
          const width = targetEl.offsetWidth || window.innerWidth;
          const height = Math.floor(width * 0.75);

          const base64 = await window.htmlToImage.toJpeg(targetEl, { 
              quality: 0.6,
              pixelRatio: 1,      // 1倍解析度，平衡效能與容量
              width: width,       // 擷取原始寬度
              height: height,     // 擷取 4:3 比例高度
              canvasWidth: 400,   // 強制縮小到 400px
              canvasHeight: 300,  // 強制縮小到 300px
              cacheBust: true,
              imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
              filter: (node) => {
                 // 💡 略過所有干擾截圖的標籤
                 if (['IFRAME', 'CANVAS', 'SCRIPT', 'NOSCRIPT'].includes(node.tagName)) return false;
                 // 💡 略過載入失敗的圖片
                 if (node.tagName === 'IMG' && (!node.complete || node.naturalWidth === 0)) return false;
                 return true;
              }
          });
          console.log("[CGA Inspector] Rendering complete. Base64 length:", base64.length);
          return base64;
      } catch (e) {
          console.error("[CGA Inspector] Screenshot FATAL ERROR:", e);
          // 💡 失敗時將 Error 轉文字印出，方便排查
          console.log("[CGA Inspector] Error Details:", e.message || e);
          return null;
      } finally {
          console.log("[CGA Inspector] Cleanup and restoring state...");
          disabledLinks.forEach(({ el, href }) => el.setAttribute('href', href));
      }
  };

  window.addEventListener('message', async (event) => {
    if (event.data?.type === 'CGA_TAKE_SCREENSHOT') {
      console.log("[CGA Inspector] Internal capture requested...");
      const base64 = await captureThumbnail();
      window.parent.postMessage({ type: 'CGA_SCREENSHOT_TAKEN', base64 }, '*');
    } else if (event.data?.type === 'CGA_SET_DRAG_API') {
      window.__cgaDraggingApi = event.data.api;
    } else if (event.data?.type === 'CGA_CLEAR_DRAG_API') {
      window.__cgaDraggingApi = null;
      clearHighlight();
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
    console.log("[CGA Inspector] Active (with URL Sync & Gap Detection Support)...");
    
    // 💡 初始網址通報
    window.parent.postMessage({ 
        type: 'CGA_ROUTE_CHANGED', 
        path: window.location.pathname + window.location.search 
    }, '*');

    // --- 🕵️‍♂️ 狀態化偵測機制 (Stateful Discovery) ---
    let isScanningPaused = false;
    const scannedGaps = new Set();

    const getFiberProps = (target) => {
        const fiberKey = Object.keys(target).find(key => key.startsWith('__reactFiber$'));
        if (!fiberKey) return null;
        return target[fiberKey]?.memoizedProps || target[fiberKey]?.pendingProps;
    };

    const isNoop = (fn) => {
        if (!fn || typeof fn !== 'function') return true;
        const str = fn.toString().replace(/\s/g, '');
        return str.includes('()=>{}') || str.includes('()=>console.log(') || str.includes('function(){}');
    };

    const scanNextGap = () => {
        if (isScanningPaused) return;

        // 尋找潛在的交互元素：button, a, form
        const candidates = document.querySelectorAll('button, a, form');
        
        for (const el of candidates) {
            const fingerprint = `${window.location.pathname}_${el.tagName}_${el.innerText.trim().substring(0, 10)}`;
            if (scannedGaps.has(fingerprint)) continue;

            const props = getFiberProps(el);
            let isUnbound = false;
            let reason = "";

            if (el.tagName === 'BUTTON') {
                if (!props?.onClick || isNoop(props.onClick)) {
                    isUnbound = true;
                    reason = "按鈕尚未綁定點擊邏輯";
                }
            } else if (el.tagName === 'FORM') {
                if (!props?.onSubmit || isNoop(props.onSubmit)) {
                    isUnbound = true;
                    reason = "表單尚未綁定提交邏輯";
                }
            }

            if (isUnbound) {
                isScanningPaused = true;
                scannedGaps.add(fingerprint);
                
                // 標記該元素以便前端高亮
                el.style.boxShadow = '0 0 0 4px rgba(234, 179, 8, 0.3)';
                
                window.parent.postMessage({
                    type: 'CGA_AURA_REPORT',
                    payload: {
                        fingerprint,
                        reason,
                        element: getElementInfo(el),
                        path: resolveExactPath(el)
                    }
                }, '*');
                console.log("[CGA Inspector] Gap found and paused:", reason);
                return; // 找到一個就停止
            }
        }
    };

    window.addEventListener('message', (event) => {
        if (event.data?.type === 'CGA_RESUME_SCAN') {
            console.log("[CGA Inspector] Resuming scan...");
            isScanningPaused = false;
            // 延遲一下再掃描，避免 UI 閃爍
            setTimeout(scanNextGap, 1000);
        }
    });

    // 初始掃描與 DOM 變動監聽
    setTimeout(scanNextGap, 3000); // 給 React 一點渲染時間

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
