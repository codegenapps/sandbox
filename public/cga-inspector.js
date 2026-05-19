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
          const msg = serializeArgs(args);
          window.parent.postMessage({ type: 'CGA_CONSOLE_LOG', level: 'error', payload: msg }, '*');
          
          if (typeof auditorConfig !== 'undefined' && auditorConfig?.runtimeError && !isScanningPaused && !msg.includes('[CGA Inspector]')) {
              // 防抖：只抓取前面一點點作為指紋，防止同樣的錯誤狂噴
              const fingerprint = `ERROR_${msg.replace(/\n/g, '').substring(0, 30)}`;
              if (typeof scannedGaps !== 'undefined' && !scannedGaps.has(fingerprint)) {
                  isScanningPaused = true;
                  scannedGaps.add(fingerprint);
                  clearGapHighlight(); // 錯誤通常是全域的，不畫框
                  window.parent.postMessage({
                      type: 'CGA_AURA_REPORT',
                      payload: {
                          fingerprint,
                          category: 'RUNTIME_ERROR',
                          reason: '主控台發生執行期錯誤',
                          element: msg.substring(0, 150) + (msg.length > 150 ? '...' : ''),
                          path: window.location.pathname
                      }
                  }, '*');
              }
          }
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
  window.__cgaSelectMode = false; // ✨ 新增：選取模式旗標

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
    } else if (event.data?.type === 'CGA_SET_SELECT_MODE') {
      window.__cgaSelectMode = !!event.data.enabled;
      if (!window.__cgaSelectMode && hoverBox) {
        hoverBox.style.display = 'none';
      }
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
    let currentHighlightedGapEl = null;
    let currentGapCategory = null; // 💡 紀錄當前高亮的類別
    let auditorConfig = {
        enabled: true,
        apiBinding: true,
        staticList: false,
        deadLink: false,
        seoMeta: false,
        imageAudit: false,
        responsive: false,
        darkMode: false,
        inputValidation: false,
        runtimeError: false
    };

    const clearGapHighlight = () => {
        if (currentHighlightedGapEl) {
            currentHighlightedGapEl.style.outline = '';
            currentHighlightedGapEl.style.outlineOffset = '';
            currentHighlightedGapEl.style.backgroundColor = '';
            currentHighlightedGapEl.style.boxShadow = '';
            currentHighlightedGapEl = null;
            currentGapCategory = null;
        }
    };

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
        if (isScanningPaused || !auditorConfig.enabled) return;

        // 收集所有潛在需要檢查的元素
        const selectors = [];
        if (auditorConfig.apiBinding) selectors.push('button', 'form');
        if (auditorConfig.deadLink) selectors.push('a');
        if (auditorConfig.imageAudit) selectors.push('img');
        if (auditorConfig.inputValidation) selectors.push('input:not([type="hidden"]):not([type="submit"]):not([type="button"])', 'textarea');
        if (auditorConfig.darkMode) selectors.push('[class*="text-[#"]', '[class*="bg-[#"]', '.text-black', '.bg-white');
        if (auditorConfig.staticList) selectors.push('ul', '.grid', '.flex');
        // responsive 不用 querySelector，改在後面獨立判斷

        if (selectors.length > 0) {
            const candidates = document.querySelectorAll(selectors.join(', '));
            
            for (const el of candidates) {
                const fingerprint = `${window.location.pathname}_${el.tagName}_${(el.innerText || el.src || el.href || '').trim().substring(0, 15)}_${el.className.substring(0, 10)}`;
                if (scannedGaps.has(fingerprint)) continue;

                const props = getFiberProps(el);
                let isUnbound = false;
                let reason = "";
                let category = "";

                // 1. API 綁定偵測 (按鈕與表單)
                if (auditorConfig.apiBinding) {
                    if (el.tagName === 'BUTTON') {
                        if (!props?.onClick || isNoop(props.onClick)) {
                            if (!(props?.type === 'submit' && el.closest('form'))) {
                                isUnbound = true; category = "API_BINDING"; reason = "按鈕缺乏點擊功能";
                            }
                        }
                    } else if (el.tagName === 'FORM') {
                        if (!props?.onSubmit || isNoop(props.onSubmit)) {
                            isUnbound = true; category = "API_BINDING"; reason = "表單缺乏送出邏輯";
                        }
                    }
                }

                // 2. 無效連結偵測 (Dead Link)
                if (!isUnbound && auditorConfig.deadLink && el.tagName === 'A') {
                    const href = el.getAttribute('href');
                    if (!href || href === '#' || href.includes('javascript:void')) {
                        isUnbound = true; category = "DEAD_LINK"; reason = "超連結缺乏有效的 href 路徑";
                    }
                }

                // 3. 圖片無障礙偵測 (Image Audit)
                if (!isUnbound && auditorConfig.imageAudit && el.tagName === 'IMG') {
                    const alt = el.getAttribute('alt');
                    if (alt === null || alt.trim() === '') {
                        isUnbound = true; category = "IMAGE_AUDIT"; reason = "圖片缺乏 alt 無障礙標籤";
                    }
                }

                // 4. 輸入框驗證偵測 (Input Validation)
                if (!isUnbound && auditorConfig.inputValidation && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                    const hasRequired = el.hasAttribute('required');
                    const hasPattern = el.hasAttribute('pattern');
                    // 如果在表單內，但沒有任何基礎原生的驗證
                    if (!hasRequired && !hasPattern && el.closest('form')) {
                        isUnbound = true; category = "INPUT_VALIDATION"; reason = "輸入框缺乏 required 屬性或基礎驗證規範";
                    }
                }

                // 5. 硬編碼顏色偵測 (Dark Mode Safety)
                if (!isUnbound && auditorConfig.darkMode) {
                    const cls = typeof el.className === 'string' ? el.className : '';
                    if (cls.includes('text-[#') || cls.includes('bg-[#') || (cls.includes('text-black') && !cls.includes('dark:text-'))) {
                        isUnbound = true; category = "DARK_MODE"; reason = "使用強制色碼，深色模式切換時可能難以閱讀";
                    }
                }

                // 6. 靜態列表偵測 (Static List)
                if (!isUnbound && auditorConfig.staticList && (el.tagName === 'UL' || (typeof el.className === 'string' && (el.className.includes('grid') || el.className.includes('flex'))))) {
                    const children = el.children;
                    if (children.length >= 3) {
                        const c1 = children[0], c2 = children[1], c3 = children[2];
                        if (c1.tagName === c2.tagName && c2.tagName === c3.tagName && c1.className === c2.className && c1.className !== '') {
                            isUnbound = true; category = "STATIC_LIST"; reason = "發現多個結構高度重複的子元件，疑似未採用動態渲染";
                        }
                    }
                }

                if (isUnbound) {
                    isScanningPaused = true;
                    scannedGaps.add(fingerprint);
                    
                    clearGapHighlight();
                    el.style.outline = '2px dashed #3b82f6';
                    el.style.outlineOffset = '4px';
                    el.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                    el.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.3)';
                    currentHighlightedGapEl = el;
                    
                    // 💡 找到缺口時，自動捲動到使用者眼前 (置中顯示)
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    window.parent.postMessage({
                        type: 'CGA_AURA_REPORT',
                        payload: {
                            fingerprint,
                            category,
                            reason,
                            element: getElementInfo(el),
                            path: resolveExactPath(el)
                        }
                    }, '*');
                    console.log(`[CGA Inspector] Gap found [${category}] and paused:`, reason);
                    return; // 找到一個就停止
                }
            }
        }

        // 7. 響應式溢出偵測 (Responsive Overflow)
        if (auditorConfig.responsive) {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            if (docWidth > winWidth + 10) { // 容忍 10px 誤差
                const fingerprint = `OVERFLOW_${window.location.pathname}`;
                if (!scannedGaps.has(fingerprint)) {
                    isScanningPaused = true;
                    scannedGaps.add(fingerprint);
                    window.parent.postMessage({
                        type: 'CGA_AURA_REPORT',
                        payload: {
                            fingerprint,
                            category: "RESPONSIVE_OVERFLOW",
                            reason: `頁面寬度 (${docWidth}px) 超出螢幕寬度 (${winWidth}px)，出現水平滾動條`,
                            element: "document.documentElement",
                            path: window.location.pathname
                        }
                    }, '*');
                    console.log(`[CGA Inspector] Overflow gap found`);
                    return;
                }
            }
        }
    };

    window.addEventListener('message', (event) => {
        if (event.data?.type === 'CGA_RESUME_SCAN') {
            console.log("[CGA Inspector] Resuming scan...");
            isScanningPaused = false;
            clearGapHighlight(); // 💡 收到繼續指令時，清除高亮
            // 延遲一下再掃描，避免 UI 閃爍
            setTimeout(scanNextGap, 1000);
        } else if (event.data?.type === 'CGA_SCROLL_TO_GAP') {
            if (currentHighlightedGapEl) {
                currentHighlightedGapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else if (event.data?.type === 'CGA_SET_AUDITOR_CONFIG') {
            const oldConfigStr = JSON.stringify(auditorConfig);
            const newConfigStr = JSON.stringify(event.data.payload);
            
            // 只有當設定真的有變動時才重置掃描，避免 React 無意義的重複渲染觸發
            if (oldConfigStr !== newConfigStr) {
                auditorConfig = event.data.payload;
                console.log("[CGA Inspector] Auditor config updated:", auditorConfig);
                
                // 💡 只要設定有變，不論是開還是關，都一律先清除目前的警告卡片與高亮
                isScanningPaused = false;
                clearGapHighlight();
                window.parent.postMessage({ type: 'CGA_CLEAR_ACTIVE_GAP' }, '*');
                
                // 清除記憶，強制重新掃描整個畫面 (因為用戶可能打開了之前關閉的開關)
                scannedGaps.clear(); 

                // 如果總開關是開著的，延遲 500ms 後發動一次全新、完整的掃描
                if (auditorConfig.enabled) {
                    setTimeout(scanNextGap, 500);
                }
            }
        }
    });

    // 初始掃描與 DOM 變動監聽
    setTimeout(scanNextGap, 3000); // 給 React 一點渲染時間

    // --- ✨ 新增：DOM Element Highlighting (Hover Inspector) ---
    let hoverBox = null;
    let hoverLabel = null;

    const createHoverBox = () => {
        if (hoverBox) return;
        hoverBox = document.createElement('div');
        hoverBox.id = 'cga-hover-box';
        hoverBox.style.cssText = `
            position: fixed !important;
            pointer-events: none !important;
            z-index: 2147483647 !important;
            border: 2px solid #3b82f6 !important;
            background-color: rgba(59, 130, 246, 0.1) !important;
            transition: all 0.05s ease-out !important;
            display: none;
        `;
        
        hoverLabel = document.createElement('div');
        hoverLabel.style.cssText = `
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            background-color: #3b82f6 !important;
            color: #ffffff !important;
            font-size: 10px !important;
            font-weight: bold !important;
            font-family: SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace !important;
            padding: 2px 6px !important;
            line-height: 1.2 !important;
            white-space: nowrap !important;
            border-radius: 0 0 4px 0 !important;
            box-shadow: 2px 2px 5px rgba(0,0,0,0.2) !important;
            z-index: 2147483647 !important;
        `;
        
        hoverBox.appendChild(hoverLabel);
        document.body.appendChild(hoverBox);
    };

    const updateHoverBox = (target) => {
        if (!hoverBox || !target || target === document.body || target === document.documentElement) {
            if (hoverBox) hoverBox.style.display = 'none';
            return;
        }

        const rect = target.getBoundingClientRect();
        
        // 💡 排除寬高為 0 的隱形元素
        if (rect.width === 0 || rect.height === 0) {
            hoverBox.style.display = 'none';
            return;
        }

        hoverBox.style.display = 'block';
        hoverBox.style.top = rect.top + 'px';
        hoverBox.style.left = rect.left + 'px';
        hoverBox.style.width = rect.width + 'px';
        hoverBox.style.height = rect.height + 'px';

        const tag = target.tagName.toLowerCase();
        let classList = target.className;
        if (typeof classList !== 'string') classList = '';
        const firstClass = classList.split(' ').filter(c => c && !c.includes(':'))[0] || '';
        
        hoverLabel.textContent = tag + (firstClass ? '.' + firstClass : '');
    };

    document.addEventListener('mousemove', (e) => {
        // 按下 Alt/Option 鍵，或是「選取模式」開啟時，顯示 Hover 框
        if (e.altKey || e.metaKey || window.__cgaSelectMode) {
            createHoverBox();
            updateHoverBox(e.target);
        } else if (hoverBox) {
            hoverBox.style.display = 'none';
        }
    });

    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Alt' || e.key === 'Meta') && hoverBox) {
            // 這個事件無法精確知道滑鼠在哪，所以我們不強制顯示
        }
    });

    document.addEventListener('keyup', (e) => {
        if ((e.key === 'Alt' || e.key === 'Meta') && !window.__cgaSelectMode && hoverBox) {
            hoverBox.style.display = 'none';
        }
    });
    // --- 結束：DOM Element Highlighting ---

    document.addEventListener('click', (e) => {
      if (e.altKey || e.metaKey || window.__cgaSelectMode) {
        e.preventDefault(); e.stopPropagation();
        const target = e.target;
        window.parent.postMessage({ type: 'CGA_ELEMENT_SELECTED', path: resolveExactPath(target), element: getElementInfo(target), outerHTML: target.outerHTML }, '*');
        
        // 點擊後隱藏 hover 框並播放目標動畫
        if (hoverBox) hoverBox.style.display = 'none';
        
        target.style.transition = 'all 0.2s ease-in-out';
        target.style.transform = 'scale(0.95)';
        target.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.5)';
        
        setTimeout(() => { 
            target.style.transform = ''; 
            target.style.boxShadow = ''; 
            target.style.transition = '';
        }, 200);

        // 如果是選取模式，選完後自動關閉（優化體驗：選一個改一個）
        // 或者保持開啟？這裡我們先保持現狀，讓用戶手動關閉。
      }
    }, true);
  });
}
