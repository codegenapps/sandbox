if (typeof window !== 'undefined') {
    // --- 1. 全域變數宣告區 ---
    window.__cgaConsoleHooked = window.__cgaConsoleHooked || false;
    window.__cgaDraggingApi = null;
    window.__cgaLastHighlighted = null;
    window.__cgaSelectMode = false;

    let __cgaHoverBox = null;
    let __cgaHoverLabel = null;

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
        responsive: false,
        darkMode: false,
        inputValidation: false,
        runtimeError: false
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
        if (auditorConfig.apiBinding) selectors.push('button', 'form');
        if (auditorConfig.deadLink) selectors.push('a');
        if (auditorConfig.imageAudit) selectors.push('img');
        if (auditorConfig.inputValidation) selectors.push('input:not([type="hidden"]):not([type="submit"]):not([type="button"])', 'textarea');
        if (auditorConfig.darkMode) selectors.push('[class*="text-[#"]', '[class*="bg-[#"]', '.text-black', '.bg-white');
        if (auditorConfig.staticList) selectors.push('ul', '.grid', '.flex');

        if (selectors.length > 0) {
            const query = selectors.join(', ');
            // console.log("[Inspector] Scanning for:", query);
            const candidates = document.querySelectorAll(query);
            // console.log("[Inspector] Found candidates:", candidates.length);

            let processedCount = 0;
            let foundAny = false;
            try {
                const candidates = document.querySelectorAll(query);
                for (let i = 0; i < candidates.length; i++) {
                    const el = candidates[i];
                    processedCount++;

                    // 💡 修正：指紋加入 Category，防止跨類別的跳過干擾
                    const fingerprint = window.location.pathname + '_' + category + '_' + i + '_' + (el.innerText || el.src || el.href || '').trim().substring(0, 15);

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

                    if (!isUnbound && auditorConfig.darkMode) {
                        const cls = typeof el.className === 'string' ? el.className : '';
                        if (cls.includes('text-[#') || cls.includes('bg-[#') || (cls.includes('text-black') && !cls.includes('dark:text-'))) {
                            isUnbound = true;
                            category = "DARK_MODE";
                            reason = "發現硬編碼顏色，可能導致深色模式相容性問題";
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
                window.parent.postMessage({ type: 'CGA_SCAN_COMPLETED' }, '*');
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

        // --- 🟢 響應式溢出偵測 ---
        if (auditorConfig.responsive) {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            if (docWidth > winWidth + 10) {
                const fingerprint = 'OVERFLOW_' + window.location.pathname + '_' + winWidth;
                if (!scannedGaps.has(fingerprint)) {
                    isScanningPaused = true;
                    scannedGaps.add(fingerprint);
                    window.parent.postMessage({
                        type: 'CGA_AURA_REPORT',
                        payload: {
                            fingerprint,
                            category: "RESPONSIVE_OVERFLOW",
                            reason: '頁面寬度 (' + docWidth + 'px) 在目前的視窗寬度 (' + winWidth + 'px) 下發生溢出，出現水平捲軸',
                            element: "document.documentElement",
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

            if (auditorConfig?.runtimeError && !isScanningPaused && !msg.includes('[CGA Inspector]')) {
                const fingerprint = `ERROR_${msg.replace(/\n/g, '').substring(0, 30)}`;
                if (!scannedGaps.has(fingerprint)) {
                    isScanningPaused = true;
                    scannedGaps.add(fingerprint);
                    clearGapHighlight();
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

        const notifyRouteChanged = () => {
            window.parent.postMessage({
                type: 'CGA_ROUTE_CHANGED',
                path: window.location.pathname + window.location.search
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
                window.parent.postMessage({
                    type: 'CGA_API_DROPPED',
                    path: resolvedPath,
                    element: info,
                    api: dragData
                }, '*');
            }
            clearHighlight();
            window.__cgaDraggingApi = null;
        } else if (event.data?.type === 'CGA_RESUME_SCAN') {
            isScanningPaused = false;
            clearGapHighlight();
            // 💡 修正：立即觸發新一輪掃描，確保能銜接下一個問題
            scanNextGap();
        } else if (event.data?.type === 'CGA_NAVIGATE') {
            const targetPath = event.data.path;
            if (targetPath && targetPath !== window.location.pathname) {
                // 💡 智慧導航：如果是 .html 結尾，或是偵測到不是 SPA 環境
                // 則執行強制跳轉 (Location)，否則僅更新 URL (SPA 模式)
                const isSpa = !!(window.__NEXT_DATA__ || window.next || window.React);

                if (targetPath.toLowerCase().endsWith('.html') || !isSpa) {
                    window.location.href = targetPath;
                } else {
                    window.history.pushState(null, '', targetPath);
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
            } else {
                console.log("[Inspector] Config unchanged, ignoring.");
            }
        }
    });

    // --- 7. DOM Load 觸發與 Hover 邏輯 ---
    window.addEventListener('load', () => {
        window.parent.postMessage({
            type: 'CGA_ROUTE_CHANGED',
            path: window.location.pathname + window.location.search
        }, '*');

        setTimeout(scanNextGap, 3000);

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
