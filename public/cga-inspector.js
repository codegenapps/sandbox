if (typeof window !== 'undefined') {
    // --- 1. 全域變數宣告區 ---
    window.__cgaConsoleHooked = window.__cgaConsoleHooked || false;
    window.__cgaDraggingApi = null;
    window.__cgaLastHighlighted = null;
    window.__cgaSelectMode = false;

    let __cgaHoverBox = null;
    let __cgaHoverLabel = null;

    // 🚀 持久化映射記錄
    window.__cgaMappings = window.__cgaMappings || {};
    window.__cgaActiveContainerPath = null; // 🚀 紀錄當前鎖定的對接容器區域

    // Auditor 狀態
    let isScanningPaused = false;
    const scannedGaps = new Set();
    let currentHighlightedGapEl = null;
    let auditorConfig = {
        enabled: false,
        apiBinding: false,
        staticList: false,
        deadLink: false,
        seoMeta: false,
        imageAudit: false,
        inputValidation: false
    };

    // --- 2. 輔助函式區 ---
    const clearHighlight = () => {
        if (window.__cgaLastHighlighted) {
            window.__cgaLastHighlighted.style.outline = '';
            window.__cgaLastHighlighted.style.outlineOffset = '';
            window.__cgaLastHighlighted.style.backgroundColor = '';
            window.__cgaLastHighlighted = null;
        }
    };

    const clearGapHighlight = () => {
        if (currentHighlightedGapEl) {
            currentHighlightedGapEl.style.outline = '';
            currentHighlightedGapEl.style.outlineOffset = '';
            currentHighlightedGapEl.style.backgroundColor = '';
            currentHighlightedGapEl.style.boxShadow = '';
            currentHighlightedGapEl = null;
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

        let finalPath = exactPath || window.location.pathname;
        // 💡 修正：針對靜態網頁，將根路徑映射回 index.html
        if (finalPath === '/' || finalPath === '') {
            finalPath = '/index.html';
        }
        return finalPath;
    };

    const getElementInfo = (target) => {
        if (!target) return "";
        const tag = target.tagName.toLowerCase();

        let className = target.className;
        if (typeof className !== 'string') className = '';

        const id = target.id || '';
        const name = target.getAttribute('name') || '';

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

    const getFiberProps = (target) => {
        const key = Object.keys(target).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactFiber$'));
        if (!key) return null;
        if (key.startsWith('__reactProps$')) return target[key];
        const fiber = target[key];
        return fiber?.memoizedProps || fiber?.pendingProps;
    };

    // 🚀 核心：物理嵌套標記 (Absolute Injection) - RWD 兼容版
    const renderBadge = (target, param) => {
        const id = 'cga-badge-' + Math.random().toString(36).substr(2, 9);

        // 💡 關鍵：確保目標是定位容器
        const originalPos = window.getComputedStyle(target).position;
        if (originalPos === 'static') target.style.position = 'relative';

        const badge = document.createElement('div');
        badge.id = id;
        badge.className = 'cga-physical-badge';
        badge.style.cssText = "position: absolute; z-index: 2147483647; top: -32px; left: 0; background: #3b82f6; color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 900; font-family: sans-serif; pointer-events: auto; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.3); white-space: nowrap; transform: scale(0.9); transform-origin: bottom left; cursor: default;";

        badge.innerHTML = '<span>LINKED: ' + param.id + '</span>';

        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = "cursor: pointer; background: rgba(0,0,0,0.3); width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 4px; font-size: 10px; transition: all 0.2s;";
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            badge.remove();
            target.style.outline = '';
            target.style.boxShadow = '';
            delete window.__cgaMappings[id];
            notifyMappingsChanged();
        };

        badge.appendChild(closeBtn);

        // 💡 處理 img/input 無法 appendChild 的情況
        if (['img', 'input', 'textarea', 'hr', 'br'].includes(target.tagName.toLowerCase())) {
            target.parentElement.style.position = 'relative';
            target.parentElement.appendChild(badge);
        } else {
            target.appendChild(badge);
        }

        target.style.outline = '3px solid #3b82f6';
        target.style.outlineOffset = '2px';
        target.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.4)';

        return id;
    };

    const notifyMappingsChanged = () => {
        (window.parent || window.top).postMessage({type: 'CGA_MAPPINGS_UPDATED', mappings: window.__cgaMappings}, '*');
    };

    const isNoop = (fn) => {
        if (!fn || typeof fn !== 'function') return true;
        const str = fn.toString();
        const compactStr = str.replace(/\s/g, '');

        // 1. 純空函數判定
        if (compactStr.length <= 15 ||
            compactStr.includes('()=>{}') ||
            compactStr.includes('function(){}') ||
            compactStr.includes('function(e){}')) {
            return true;
        }

        // 2. 核心：真假 API 判定 (Aggressive Mode)
        // 只要函數中沒有出現真實網路請求 (fetch, axios, api.) 或異步特徵 (await, mutation, dispatch)
        // 即便寫了一堆 setTimeout 或 console.log，也判定為「未串接真實業務邏輯」。
        // 💡 警告：絕對不要加入 'submit' 或 'set'，會誤殺 setIsSubmitting 這種 UI 狀態。
        const hasRealAction = /fetch\(|axios\.|api\.|await |dispatch\(|useMutation/i.test(compactStr);

        if (!hasRealAction) {
            return true; // 判定為無靈魂的 Mock 代碼
        }
        return false;
    };
    // --- 3. 截圖功能 ---
    const captureThumbnail = async () => {
        if (typeof window.htmlToImage === 'undefined') {
            try {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = "https://unpkg.com/html-to-image@1.11.11/dist/html-to-image.js";
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            } catch (e) {
                return null;
            }
        }

        const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
        const disabledLinks = [];
        links.forEach(link => {
            if (link.href && !link.href.startsWith(window.location.origin)) {
                const originalHref = link.href;
                disabledLinks.push({el: link, href: originalHref});
                link.removeAttribute('href');
            }
        });

        const targetEl = document.getElementById('root') || document.getElementById('__next') || document.body;

        try {
            const width = targetEl.offsetWidth || window.innerWidth;
            const height = Math.floor(width * 0.75);

            const base64 = await window.htmlToImage.toJpeg(targetEl, {
                quality: 0.6,
                pixelRatio: 1,
                width: width,
                height: height,
                canvasWidth: 400,
                canvasHeight: 300,
                cacheBust: true,
                imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
                filter: (node) => {
                    if (['IFRAME', 'CANVAS', 'SCRIPT', 'NOSCRIPT'].includes(node.tagName)) return false;
                    if (node.tagName === 'IMG' && (!node.complete || node.naturalWidth === 0)) return false;
                    return true;
                }
            });
            return base64;
        } catch (e) {
            return null;
        } finally {
            disabledLinks.forEach(({el, href}) => el.setAttribute('href', href));
        }
    };

    // --- 4. Quality Auditor (掃描器) ---
    const scanNextGap = () => {
        if (isScanningPaused || !auditorConfig.enabled) return;

        const selectors = [];
        // [暫時註解] apiBinding 在 User-Driven 模式下暫不需要主動掃描
        // if (auditorConfig.apiBinding) selectors.push('button', 'form');
        if (auditorConfig.deadLink) selectors.push('a');
        if (auditorConfig.imageAudit) selectors.push('img');
        // [暫時註解] inputValidation 屬於常規表單，暫不主動掃描
        // if (auditorConfig.inputValidation) selectors.push('input:not([type="hidden"]):not([type="submit"]):not([type="button"])', 'textarea');
        // [暫時註解] staticList 容易誤殺 Layout，暫不主動掃描
        // if (auditorConfig.staticList) selectors.push('ul', '.grid', '.flex');

        if (selectors.length > 0) {
            const query = selectors.join(', ');

            let processedCount = 0;
            let foundAny = false;
            try {
                const candidates = document.querySelectorAll(query);
                for (let i = 0; i < candidates.length; i++) {
                    const el = candidates[i];
                    processedCount++;

                    // 💡 修正：指紋加入 index (i)，防止相同內容的元件互相碰撞
                    const fingerprint = window.location.pathname + '_' + el.tagName + '_' + i + '_' + (el.innerText || el.src || el.href || '').trim().substring(0, 15);

                    if (scannedGaps.has(fingerprint)) {
                        continue;
                    }

                    const props = getFiberProps(el);
                    let isUnbound = false;
                    let reason = "";
                    let category = "";

                    if (auditorConfig.apiBinding) {
                        if (el.tagName === 'BUTTON') {
                            const hasHandler = (props && (props.onClick || props.onPress)) || el.onclick;
                            if (!hasHandler || isNoop(props?.onClick || props?.onPress || el.onclick)) {
                                if (!(props?.type === 'submit' && el.closest('form')) && !(el.type === 'submit' && el.closest('form'))) {
                                    isUnbound = true;
                                    category = "API_BINDING";
                                    reason = "按鈕缺乏點擊功能";
                                }
                            }
                        } else if (el.tagName === 'FORM') {
                            const hasSubmit = (props && (props.onSubmit || props.action)) || el.onsubmit || el.action;
                            if (!hasSubmit || isNoop(props?.onSubmit || el.onsubmit)) {
                                isUnbound = true;
                                category = "API_BINDING";
                                reason = "表單缺乏送出邏輯";
                            }
                        }
                    }

                    if (!isUnbound && auditorConfig.deadLink && el.tagName === 'A') {
                        const href = el.getAttribute('href');
                        if (!href || href === '#' || href.trim() === '' || href.includes('javascript:void')) {
                            isUnbound = true;
                            category = "DEAD_LINK";
                            reason = "超連結缺乏有效的導航路徑（僅為 # 或空值）";
                        }
                    }

                    if (!isUnbound && auditorConfig.imageAudit && el.tagName === 'IMG') {
                        const alt = el.getAttribute('alt');
                        const isBroken = el.complete && (typeof el.naturalWidth !== 'undefined' && el.naturalWidth === 0);
                        if (isBroken) {
                            isUnbound = true;
                            category = "IMAGE_AUDIT";
                            reason = "偵測到失效的圖片連結 (破圖)";
                        } else if (alt === null || alt.trim() === '') {
                            isUnbound = true;
                            category = "IMAGE_AUDIT";
                            reason = "圖片缺乏 alt 無障礙標籤，不利於 SEO";
                        }
                    }

                    if (!isUnbound && auditorConfig.inputValidation && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                        const hasRequired = el.hasAttribute('required');
                        const hasPattern = el.hasAttribute('pattern');
                        if (!hasRequired && !hasPattern && el.closest('form')) {
                            isUnbound = true;
                            category = "INPUT_VALIDATION";
                            reason = "表單輸入框缺乏驗證規則 (如必填或格式限制)";
                        }
                    }

                    if (!isUnbound && auditorConfig.staticList && (el.tagName === 'UL' || (typeof el.className === 'string' && (el.className.includes('grid') || el.className.includes('flex'))))) {
                        const children = el.children;
                        if (children.length >= 3) {
                            const c1 = children[0], c2 = children[1], c3 = children[2];
                            if (c1.tagName === c2.tagName && c2.tagName === c3.tagName && c1.className === c2.className && c1.className !== '') {
                                isUnbound = true;
                                category = "STATIC_LIST";
                                reason = "偵測到高度重複的內容塊，建議改為動態渲染 (map)";
                            }
                        }
                    }

                    if (isUnbound) {
                        isScanningPaused = true;
                        foundAny = true;
                        scannedGaps.add(fingerprint);

                        clearGapHighlight();
                        el.style.outline = '2px dashed #3b82f6';
                        el.style.outlineOffset = '4px';
                        el.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                        el.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.3)';
                        currentHighlightedGapEl = el;

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
                        return; // 找到一個後暫停掃描
                    }
                }
            } catch (loopError) {
                console.error("[Inspector] Loop crashed", loopError);
            }

            // 💡 修正：如果掃完一整圈都沒發現，通知前端「掃描完成」
            if (!foundAny) {
                window.parent.postMessage({type: 'CGA_SCAN_COMPLETED'}, '*');
            }
        }

        // --- 🟢 SEO 標籤偵測 (進階版) ---
        if (auditorConfig.seoMeta) {
            const getMeta = (name, property) => {
                if (name) return document.querySelector('meta[name="' + name + '"]')?.getAttribute('content');
                if (property) return document.querySelector('meta[property="' + property + '"]')?.getAttribute('content');
                return null;
            };

            const title = document.title;
            const desc = getMeta('description');
            const ogImg = getMeta(null, 'og:image');
            const ogTitle = getMeta(null, 'og:title');
            const h1s = document.querySelectorAll('h1');

            let missing = [];
            let warnings = [];

            if (!title) missing.push("網頁標題 (Title)");
            else if (title.length < 10) warnings.push("標題太短 (建議 10 字以上)");
            else if (title.length > 60) warnings.push("標題太長 (建議 60 字以內)");

            if (!desc) missing.push("網頁描述 (Description)");
            else if (desc.length < 30) warnings.push("描述太短 (建議 30 字以上)");

            if (!ogImg) missing.push("社群分享圖片 (og:image)");
            if (!ogTitle) missing.push("社群分享標題 (og:title)");

            if (h1s.length === 0) warnings.push("缺少 H1 主要標題");
            else if (h1s.length > 1) warnings.push("偵測到多個 H1 標題 (建議全頁唯一)");

            if (missing.length > 0 || warnings.length > 0) {
                const fingerprint = 'SEO_' + window.location.pathname;
                if (!scannedGaps.has(fingerprint)) {
                    isScanningPaused = true;
                    scannedGaps.add(fingerprint);

                    const reason = missing.length > 0
                        ? "缺乏關鍵 SEO 標籤：" + missing.join(', ')
                        : "SEO 結構警告：" + warnings.join(', ');

                    window.parent.postMessage({
                        type: 'CGA_AURA_REPORT',
                        payload: {
                            fingerprint,
                            category: "SEO_META",
                            reason,
                            element: "document.head",
                            path: window.location.pathname
                        }
                    }, '*');
                    return;
                }
            }
        }
    };

    // --- 5. 初始化與攔截設定 ---
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
                    try {
                        return JSON.stringify(arg);
                    } catch (e) {
                        return '[Circular Object]';
                    }
                }
                return String(arg);
            }).join(' ');
        };

        console.log = (...args) => {
            if (!args[0]?.includes?.('[CGA Inspector]')) {
                window.parent.postMessage({type: 'CGA_CONSOLE_LOG', level: 'info', payload: serializeArgs(args)}, '*');
            }
            originalLog(...args);
        };
        console.warn = (...args) => {
            window.parent.postMessage({type: 'CGA_CONSOLE_LOG', level: 'warn', payload: serializeArgs(args)}, '*');
            originalWarn(...args);
        };
        console.error = (...args) => {
            const msg = serializeArgs(args);
            window.parent.postMessage({type: 'CGA_CONSOLE_LOG', level: 'error', payload: msg}, '*');
            originalError(...args);
        };

        const notifyRouteChanged = () => {
            window.parent.postMessage({
                type: 'CGA_ROUTE_CHANGED',
                // 🚀 關鍵修復：路由變更推送時補上 window.location.hash，避免錨點/#about等在傳輸時被截斷或遺失！
                path: window.location.pathname + window.location.search + window.location.hash
            }, '*');
        };

        const originalPushState = window.history.pushState;
        window.history.pushState = function (...args) {
            originalPushState.apply(this, args);
            notifyRouteChanged();
        };

        const originalReplaceState = window.history.replaceState;
        window.history.replaceState = function (...args) {
            originalReplaceState.apply(this, args);
            notifyRouteChanged();
        };

        window.addEventListener('popstate', notifyRouteChanged);
        window.addEventListener('hashchange', notifyRouteChanged); // 🚀 關鍵新增：監聽 Hash 錨點原生變化，自動推送！
    }

    // --- 6. 監聽父視窗指令 ---
    window.addEventListener('message', async (event) => {
        if (event.data?.type === 'CGA_TAKE_SCREENSHOT') {
            const base64 = await captureThumbnail();
            window.parent.postMessage({type: 'CGA_SCREENSHOT_TAKEN', base64}, '*');
        } else if (event.data?.type === 'CGA_SET_SELECT_MODE') {
            window.__cgaSelectMode = !!event.data.enabled;
            if (!window.__cgaSelectMode && __cgaHoverBox) {
                __cgaHoverBox.style.display = 'none';
            }
        } else if (event.data?.type === 'CGA_SET_DRAG_API') {
            window.__cgaDraggingApi = event.data.api;
        } else if (event.data?.type === 'CGA_CLEAR_DRAG_API') {
            window.__cgaDraggingApi = null;
            clearHighlight();
        } else if (event.data?.type === 'CGA_INTERNAL_DRAG_OVER') {
            const t = document.elementFromPoint(event.data.x, event.data.y);
            if (t && t !== window.__cgaLastHighlighted) {
                // 🛡️ 拖曳中的邊界引導
                if (window.__cgaActiveContainerPath) {
                    const container = document.querySelector(window.__cgaActiveContainerPath);
                    if (container && !container.contains(t)) {
                        clearHighlight();
                        return;
                    }
                }
                clearHighlight();
                t.style.outline = '2px dashed #a855f7';
                t.style.outlineOffset = '2px';
                t.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                window.__cgaLastHighlighted = t;
            }
        } else if (event.data?.type === 'CGA_INTERNAL_DRAG_LEAVE') {
            clearHighlight();
        } else if (event.data?.type === 'CGA_INTERNAL_DROP') {
            const target = document.elementFromPoint(event.data.x, event.data.y);
            if (target && window.__cgaDraggingApi) {
                const dragData = window.__cgaDraggingApi;
                const resolvedPath = resolveExactPath(target);
                // 🚀 物理提權：嘗試尋找最近的業務容器，以便渲染完整的視覺骨架
                const container = target.closest('.glass-panel, section, article, div[class*="item"], div[class*="card"], li, .group') || target.parentElement || target;

                // 🛡️ 紀錄鎖定路徑供後續參數投遞檢查
                const idx = Array.from(document.querySelectorAll(container.tagName)).indexOf(container);
                const selector = container.tagName.toLowerCase() + ':nth-of-type(' + (idx + 1) + ')';
                window.__cgaActiveContainerPath = selector;

                window.parent.postMessage({
                    type: 'CGA_API_DROPPED',
                    path: resolvedPath,
                    containerPath: selector, // 🚀 新增傳送容器選擇器
                    element: container.outerHTML,
                    api: dragData
                }, '*');
            }
            clearHighlight();
            window.__cgaDraggingApi = null;
        } else if (event.data?.type === 'CGA_PARAM_DROPPED') {
            // 🚀 核心：參數投遞處理 (畫布直連)
            const t = document.elementFromPoint(event.data.x, event.data.y);
            if (!t || !event.data.param) return;

            // 🛡️ 區域保護邏輯
            if (window.__cgaActiveContainerPath) {
                const container = document.querySelector(window.__cgaActiveContainerPath);
                if (container && !container.contains(t)) {
                    alert('⚠️ 對接失敗：請將參數拖曳到當前選定的組件區域內！');
                    return;
                }
            }

            const badgeId = renderBadge(t, event.data.param);
            window.__cgaMappings[badgeId] = {
                paramId: event.data.param.id,
                elementInfo: getElementInfo(t),
                path: resolveExactPath(t)
            };
            notifyMappingsChanged();
            clearHighlight();
        } else if (event.data?.type === 'CGA_CLEAR_MAPPINGS') {
            // 🚀 一鍵清除畫布標記
            const badges = document.querySelectorAll('.cga-physical-badge');
            badges.forEach(b => b.remove());
            // 清除所有高亮
            const els = document.querySelectorAll('[style*="outline"]');
            els.forEach(el => {
                el.style.outline = '';
                el.style.boxShadow = '';
            });
            window.__cgaMappings = {};
            notifyMappingsChanged();
        } else if (event.data?.type === 'CGA_RESUME_SCAN') {
            isScanningPaused = false;
            clearGapHighlight();
            // 💡 修正：立即觸發新一輪掃描，確保能銜接下一個問題
            scanNextGap();
        } else if (event.data?.type === 'CGA_NAVIGATE') {
            const targetPath = event.data.path;
            if (targetPath) {
                // 💡 強制使用 location.href 進行跳轉，確保頁面內容更新
                // 雖然會導致 Reload，但這是最穩健的跨框架導航方式
                if (targetPath !== window.location.pathname + window.location.search) {
                    window.location.href = targetPath;
                }
            }
        } else if (event.data?.type === 'CGA_SCROLL_TO_GAP') {
            if (currentHighlightedGapEl) {
                currentHighlightedGapEl.scrollIntoView({behavior: 'smooth', block: 'center'});
            }
        } else if (event.data?.type === 'CGA_SET_AUDITOR_CONFIG') {
            const oldConfigStr = JSON.stringify(auditorConfig);
            const newConfigStr = JSON.stringify(event.data.payload);

            // console.log(`[Inspector RX] Received CGA_SET_AUDITOR_CONFIG. Old: ${oldConfigStr}, New: ${newConfigStr}`);

            if (oldConfigStr !== newConfigStr) {
                // console.log("[Inspector] Config changed, resetting scan state and triggering scanNextGap...");
                auditorConfig = event.data.payload;

                isScanningPaused = false;
                clearGapHighlight();
                window.parent.postMessage({type: 'CGA_CLEAR_ACTIVE_GAP'}, '*');

                scannedGaps.clear();

                if (auditorConfig.enabled) {
                    setTimeout(scanNextGap, 500);
                }
            }
        }
    });

    // --- 7. DOM Load 觸發與 Hover 邏輯 ---
    window.addEventListener('load', () => {
        window.parent.postMessage({
            type: 'CGA_ROUTE_CHANGED',
            path: window.location.pathname + window.location.search + window.location.hash
        }, '*');

        setTimeout(scanNextGap, 3000);

        // 🚀 CGA 系統加固：一頁式網站「滾動錨點與外層網址列」實時同步攔截器
        // 💡 關鍵修復：延遲 2000 毫秒綁定，等候 React / Next.js 虛擬 DOM 完全水合渲染完畢，絕不抓空！
        setTimeout(() => {
            try {
                const sections = document.querySelectorAll('section[id], div[id]');
                if (sections.length > 0) {
                    const anchorObserver = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                const id = entry.target.getAttribute('id');
                                const newHash = '#' + id;
                                // 💡 直接調用原生的 replaceState 變更網址 Hash，這會自動觸發我們重寫的攔截器，
                                // 自動推送帶有 #Hash 的新路徑給外層，完美閉環！
                                window.history.replaceState(null, '', newHash);
                            }
                        });
                    }, {
                        threshold: 0.4,
                        rootMargin: '-15% 0px -45% 0px'
                    });
                    sections.forEach(s => anchorObserver.observe(s));
                }
            } catch (anchorErr) {
                console.error("[CGA Inspector] Anchor scroll spy registration failed:", anchorErr);
            }
        }, 2000);

        const createHoverBox = () => {
            if (__cgaHoverBox) return;
            __cgaHoverBox = document.createElement('div');
            __cgaHoverBox.id = 'cga-hover-box';
            __cgaHoverBox.style.cssText = `
            position: fixed !important;
            pointer-events: none !important;
            z-index: 2147483647 !important;
            border: 2px solid #3b82f6 !important;
            background-color: rgba(59, 130, 246, 0.1) !important;
            transition: all 0.05s ease-out !important;
            display: none;
        `;

            __cgaHoverLabel = document.createElement('div');
            __cgaHoverLabel.style.cssText = `
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
            transform: translateY(-100%) !important;
        `;

            __cgaHoverBox.appendChild(__cgaHoverLabel);
            document.body.appendChild(__cgaHoverBox);
        };

        const updateHoverBox = (target) => {
            if (!__cgaHoverBox || !target || target === document.body || target === document.documentElement) {
                if (__cgaHoverBox) __cgaHoverBox.style.display = 'none';
                return;
            }

            const rect = target.getBoundingClientRect();

            if (rect.width === 0 || rect.height === 0) {
                __cgaHoverBox.style.display = 'none';
                return;
            }

            __cgaHoverBox.style.display = 'block';
            __cgaHoverBox.style.top = rect.top + 'px';
            __cgaHoverBox.style.left = rect.left + 'px';
            __cgaHoverBox.style.width = rect.width + 'px';
            __cgaHoverBox.style.height = rect.height + 'px';

            const tag = target.tagName.toLowerCase();
            let classList = target.className;
            if (typeof classList !== 'string') classList = '';
            const firstClass = classList.split(' ').filter(c => c && !c.includes(':'))[0] || '';

            __cgaHoverLabel.textContent = tag + (firstClass ? '.' + firstClass : '');
        };

        document.addEventListener('mousemove', (e) => {
            if (e.altKey || e.metaKey || window.__cgaSelectMode) {
                if (__cgaHoverBox && __cgaHoverBox.style.display === 'none') {
                    __cgaHoverBox.style.display = 'block';
                }
                createHoverBox();
                updateHoverBox(e.target);
            } else if (__cgaHoverBox) {
                __cgaHoverBox.style.display = 'none';
            }
        });

        document.addEventListener('keyup', (e) => {
            if ((e.key === 'Alt' || e.key === 'Meta') && !window.__cgaSelectMode && __cgaHoverBox) {
                __cgaHoverBox.style.display = 'none';
            }
        });

        document.addEventListener('click', (e) => {
            if (e.altKey || e.metaKey || window.__cgaSelectMode) {
                e.preventDefault();
                e.stopPropagation();
                const target = e.target;
                window.parent.postMessage({
                    type: 'CGA_ELEMENT_SELECTED',
                    path: resolveExactPath(target),
                    element: getElementInfo(target),
                    outerHTML: target.outerHTML
                }, '*');

                if (__cgaHoverBox) __cgaHoverBox.style.display = 'none';

                target.style.transition = 'all 0.2s ease-in-out';
                target.style.transform = 'scale(0.95)';
                target.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.5)';

                setTimeout(() => {
                    target.style.transform = '';
                    target.style.boxShadow = '';
                    target.style.transition = '';
                }, 200);
            }
        }, true);
    });
}
