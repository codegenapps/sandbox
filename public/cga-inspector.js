/**
 * CGA Inspector - 核心偵測與通訊腳本 (重構強化版)
 * 作用：注入 Iframe，負責元素選取、API 拖放、品質掃描與父視窗通訊。
 */
if (typeof window !== 'undefined') {
    // ----------------------------------------------------------------------
    // 1. 全域狀態與設定
    // ----------------------------------------------------------------------
    window.__cgaConsoleHooked = window.__cgaConsoleHooked || false;
    window.__cgaSelectMode = false;
    window.__cgaDraggingApi = null;

    let __cgaHoverBox = null;
    let __cgaHoverLabel = null;
    let isScanningPaused = false;
    const scannedGaps = new Set();
    let currentHighlightedGapEl = null;

    let auditorConfig = {
        enabled: true,
        apiBinding: true,
        staticList: true,
        deadLink: true,
        seoMeta: true,
        imageAudit: true,
        responsive: true,
        darkMode: true,
        inputValidation: true,
        runtimeError: true
    };

    // ----------------------------------------------------------------------
    // 2. 核心工具函式
    // ----------------------------------------------------------------------
    const clearGapHighlight = () => {
        if (currentHighlightedGapEl) {
            currentHighlightedGapEl.style.outline = '';
            currentHighlightedGapEl.style.outlineOffset = '';
            currentHighlightedGapEl.style.backgroundColor = '';
            currentHighlightedGapEl.style.boxShadow = '';
            currentHighlightedGapEl = null;
        }
    };

    const getElementInfo = (target) => {
        try {
            if (!target) return "";
            const tag = target.tagName.toLowerCase();
            const id = target.id ? `#${target.id}` : '';
            const rawClass = typeof target.className === 'string' ? target.className : (target.getAttribute?.('class') || '');
            const cls = rawClass ? `.${rawClass.trim().split(/\s+/).join('.')}` : '';
            let text = (target.innerText || '').replace(/\n/g, ' ').trim();
            if (text.length > 30) text = text.substring(0, 30) + '...';
            return `<${tag}${id}${cls}>${text}</${tag}>`;
        } catch (e) { return "<unknown-element>"; }
    };

    const resolveExactPath = (target) => {
        try {
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
        } catch (e) { return window.location.pathname; }
    };

    const getFiberProps = (target) => {
        try {
            const key = Object.keys(target).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$'));
            if (!key) return null;
            let fiber = target[key];
            // 向上搜尋 5 層，確保抓到被包裝的事件
            for (let i = 0; i < 5 && fiber; i++) {
                const p = fiber.memoizedProps || fiber.pendingProps;
                if (p && (p.onClick || p.onSubmit || p.href || p.to)) return p;
                fiber = fiber.return;
            }
            return target[key]?.memoizedProps || target[key]?.pendingProps || target[key];
        } catch (e) { return null; }
    };

    const isNoop = (fn) => {
        if (!fn || typeof fn !== 'function') return true;
        const str = fn.toString().replace(/\s/g, '');
        return str.includes('()=>{}') || str.includes('()=>console.log(') || str.includes('function(){}');
    };

    // ----------------------------------------------------------------------
    // 3. Quality Auditor (全功能偵測引擎)
    // ----------------------------------------------------------------------
    let lastReportHash = "";

    const scanNextGap = () => {
        if (!auditorConfig.enabled) {
            if (lastReportHash !== "DISABLED") {
                lastReportHash = "DISABLED";
                window.parent.postMessage({ type: 'CGA_AURA_BATCH_REPORT', payload: [] }, '*');
            }
            return;
        }

        const currentBatchGaps = []; 

        try {
            const currentPath = window.location.pathname;

            // 1. SEO 偵測
            if (auditorConfig.seoMeta) {
                const title = document.title;
                const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
                if (!title || title === 'React App' || !metaDesc) {
                    currentBatchGaps.push({ 
                        fingerprint: `SEO::${currentPath}`, 
                        category: "SEO_META", 
                        reason: "頁面缺乏有效的 Title 或 Meta Description 標籤", 
                        element: "document.head", 
                        path: currentPath 
                    });
                }
            }

            // 2. 構建選取器
            const selectors = [];
            if (auditorConfig.apiBinding) selectors.push('button', 'form', 'a.btn', 'a.button', '[role="button"]');
            if (auditorConfig.deadLink) selectors.push('a');
            if (auditorConfig.imageAudit) selectors.push('img');
            if (auditorConfig.inputValidation) selectors.push('input:not([type="hidden"])', 'textarea');
            if (auditorConfig.darkMode) selectors.push('[class*="text-[#"]', '[class*="bg-[#"]');
            if (auditorConfig.staticList) selectors.push('ul', '.grid', '.flex');

            if (selectors.length > 0) {
                const candidates = document.querySelectorAll(selectors.join(', '));
                for (const el of candidates) {
                    try {
                        const rect = el.getBoundingClientRect();
                        if (rect.width === 0 && rect.height === 0) continue; 

                        // 💡 使用文件絕對座標，確保捲動後依然精準
                        const docTop = Math.round(rect.top + window.scrollY);
                        const docLeft = Math.round(rect.left + window.scrollX);
                        const baseFp = `${currentPath}::${el.tagName}::${docTop}::${docLeft}`;

                        const props = getFiberProps(el);
                        const rawClass = typeof el.className === 'string' ? el.className : (el.getAttribute?.('class') || '');

                        // A. API 綁定
                        if (auditorConfig.apiBinding) {
                            const isButton = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || rawClass.includes('btn') || rawClass.includes('button');
                            if (isButton) {
                                const hasClick = (props?.onClick && !isNoop(props.onClick)) || el.hasAttribute('onclick');
                                const isInLink = el.closest('a');
                                if (!hasClick && !isInLink && !(props?.type === 'submit' && el.closest('form'))) {
                                    currentBatchGaps.push({ 
                                        fingerprint: `${baseFp}::API`, 
                                        category: "API_BINDING", 
                                        reason: "按鈕缺乏點擊功能或動作綁定", 
                                        element: getElementInfo(el), 
                                        path: resolveExactPath(el) 
                                    });
                                }
                            }
                        }

                        // B. 無效連結
                        if (auditorConfig.deadLink && el.tagName === 'A') {
                            const h = el.getAttribute('href');
                            if (!h || h === '#' || h.includes('javascript:void')) {
                                currentBatchGaps.push({ 
                                    fingerprint: `${baseFp}::LINK`, 
                                    category: "DEAD_LINK", 
                                    reason: "發現無效或空的超連結", 
                                    element: getElementInfo(el), 
                                    path: resolveExactPath(el) 
                                });
                            }
                        }

                        // C. 圖片 alt
                        if (auditorConfig.imageAudit && el.tagName === 'IMG' && !el.alt) {
                            currentBatchGaps.push({ 
                                fingerprint: `${baseFp}::IMG`, 
                                category: "IMAGE_AUDIT", 
                                reason: "圖片缺乏 alt 無障礙描述", 
                                element: getElementInfo(el), 
                                path: resolveExactPath(el) 
                            });
                        }

                        // D. 輸入驗證
                        if (auditorConfig.inputValidation && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                            if (!el.hasAttribute('required') && el.closest('form')) {
                                currentBatchGaps.push({ 
                                    fingerprint: `${baseFp}::VALIDATION`, 
                                    category: "INPUT_VALIDATION", 
                                    reason: "輸入框在表單內缺乏 required 基礎驗證", 
                                    element: getElementInfo(el), 
                                    path: resolveExactPath(el) 
                                });
                            }
                        }

                        // E. 硬編碼顏色
                        if (auditorConfig.darkMode) {
                            if (rawClass.match(/(text|bg)-\[#([0-9a-fA-F]{3,6})\]/)) {
                                currentBatchGaps.push({ 
                                    fingerprint: `${baseFp}::COLOR`, 
                                    category: "DARK_MODE", 
                                    reason: "使用硬編碼色碼，深色模式切換時可能失效", 
                                    element: getElementInfo(el), 
                                    path: resolveExactPath(el) 
                                });
                            }
                        }

                        // F. 靜態列表
                        if (auditorConfig.staticList && el.children.length >= 3) {
                            const c = el.children;
                            const t0 = c[0].tagName;
                            const cl0 = c[0].getAttribute?.('class') || '';
                            if (c[1].tagName === t0 && c[2].tagName === t0 && (c[1].getAttribute?.('class') || '') === cl0 && cl0 !== '') {
                                currentBatchGaps.push({ 
                                    fingerprint: `${baseFp}::LIST`, 
                                    category: "STATIC_LIST", 
                                    reason: "偵測到高度重複的靜態結構，建議改用數據驅動渲染", 
                                    element: getElementInfo(el), 
                                    path: resolveExactPath(el) 
                                });
                            }
                        }
                    } catch (itemErr) { /* Skip item */ }
                }
            }

            // 3. 響應式溢出
            if (auditorConfig.responsive) {
                const docWidth = document.documentElement.scrollWidth;
                const winWidth = window.innerWidth;
                if (docWidth > winWidth + 5) { 
                    currentBatchGaps.push({ 
                        fingerprint: `OVERFLOW::${currentPath}`, 
                        category: "RESPONSIVE_OVERFLOW", 
                        reason: `頁面寬度 (${docWidth}px) 超出螢幕寬度 (${winWidth}px)`, 
                        element: "document.body", 
                        path: currentPath 
                    });
                }
            }
        } catch (globalErr) { console.error("[CGA Auditor] Critical failure", globalErr); }

        // ✨ 統一發送：Hash 比對，減少 React 負擔
        const currentHash = JSON.stringify(currentBatchGaps.map(g => g.fingerprint).sort());
        if (currentHash !== lastReportHash) {
            lastReportHash = currentHash;
            window.parent.postMessage({ type: 'CGA_AURA_BATCH_REPORT', payload: currentBatchGaps }, '*');
        }
    };

    // ----------------------------------------------------------------------
    // 4. 事件攔截與通訊
    // ----------------------------------------------------------------------
    if (!window.__cgaConsoleHooked) {
        window.__cgaConsoleHooked = true;
        const originalError = console.error;
        console.error = (...args) => {
            const msg = args.join(' ');
            window.parent.postMessage({ type: 'CGA_CONSOLE_LOG', level: 'error', payload: msg, timestamp: new Date().toLocaleTimeString() }, '*');
            if (auditorConfig.runtimeError && !isScanningPaused && !msg.includes('[CGA Inspector]')) {
                const f = `ERR::${msg.substring(0, 50)}`;
                if (!scannedGaps.has(f)) {
                    scannedGaps.add(f);
                    window.parent.postMessage({ type: 'CGA_AURA_REPORT', payload: { fingerprint: f, category: 'RUNTIME_ERROR', reason: '主控台發生錯誤', element: msg.substring(0, 100), path: window.location.pathname }}, '*');
                }
            }
            originalError(...args);
        };
    }

    window.addEventListener('message', (event) => {
        const { type, payload, enabled, path, fingerprint } = event.data || {};
        if (type === 'CGA_SET_SELECT_MODE') {
            window.__cgaSelectMode = !!enabled;
            if (!window.__cgaSelectMode && __cgaHoverBox) __cgaHoverBox.style.display = 'none';
        } else if (type === 'CGA_SET_AUDITOR_CONFIG') {
            auditorConfig = payload; clearGapHighlight();
            scanNextGap();
        } else if (type === 'CGA_FORCE_SCAN') {
            lastReportHash = ""; scanNextGap();
        } else if (type === 'CGA_NAVIGATE') {
            if (path && path !== window.location.pathname) window.history.pushState(null, '', path);
        } else if (type === 'CGA_SCROLL_TO_GAP') {
            if (fingerprint) {
                const parts = fingerprint.split('::');
                if (parts.length < 5) return;
                // 格式: [PATH, TAGNAME, TOP, LEFT, SUFFIX]
                const suffix = parts.pop();
                const left = parseInt(parts.pop(), 10);
                const top = parseInt(parts.pop(), 10);
                const tagName = parts.pop();
                const targetPath = parts.join('::'); // 還原可能包含 :: 的 path

                const executeLocate = () => {
                    const candidates = document.querySelectorAll(tagName);
                    let targetEl = null;
                    for (const el of candidates) {
                        const rect = el.getBoundingClientRect();
                        const dTop = Math.round(rect.top + window.scrollY);
                        const dLeft = Math.round(rect.left + window.scrollX);
                        // 容許 5px 誤差，因為 SPA 切換時 scroll 位置可能會輕微影響
                        if (Math.abs(dTop - top) <= 5 && Math.abs(dLeft - left) <= 5) {
                            targetEl = el; break;
                        }
                    }

                    if (targetEl) {
                        clearGapHighlight();
                        targetEl.style.outline = '3px solid #3b82f6';
                        targetEl.style.outlineOffset = '4px';
                        targetEl.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                        targetEl.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.4)';
                        currentHighlightedGapEl = targetEl;
                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                        console.warn('[CGA Inspector] Locate failed: Element not found at expected position', top, left);
                    }
                };

                // 💡 跨路由定位：如果錯誤不在當前頁面，先跳轉
                if (targetPath && targetPath !== window.location.pathname) {
                    window.history.pushState(null, '', targetPath);
                    // 發送事件讓上層知道路徑變了，以同步 Header 網址列
                    window.parent.postMessage({ type: 'CGA_ROUTE_CHANGED', path: targetPath }, '*');
                    // 給 SPA 一點時間渲染新頁面，再執行定位
                    setTimeout(executeLocate, 300);
                } else {
                    executeLocate();
                }
            }
        }
    });

    // 💡 Hover Box
    const updateHoverBox = (target) => {
        if (!target || target === document.body || target === document.documentElement) {
            if (__cgaHoverBox) __cgaHoverBox.style.display = 'none';
            return;
        }
        if (!__cgaHoverBox) {
            __cgaHoverBox = document.createElement('div');
            __cgaHoverBox.style.cssText = "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);display:none;";
            __cgaHoverLabel = document.createElement('div');
            __cgaHoverLabel.style.cssText = "position:absolute;top:0;left:0;background:#3b82f6;color:#fff;font-size:10px;padding:2px 6px;transform:translateY(-100%);font-weight:bold;";
            __cgaHoverBox.appendChild(__cgaHoverLabel);
            document.body.appendChild(__cgaHoverBox);
        }
        const rect = target.getBoundingClientRect();
        if (rect.width === 0) return;
        __cgaHoverBox.style.display = 'block';
        __cgaHoverBox.style.top = rect.top + 'px'; __cgaHoverBox.style.left = rect.left + 'px';
        __cgaHoverBox.style.width = rect.width + 'px'; __cgaHoverBox.style.height = rect.height + 'px';
        __cgaHoverLabel.textContent = target.tagName.toLowerCase();
    };

    document.addEventListener('mousemove', (e) => {
        if (e.altKey || window.__cgaSelectMode) updateHoverBox(e.target);
        else if (__cgaHoverBox) __cgaHoverBox.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
        if (e.altKey || window.__cgaSelectMode) {
            e.preventDefault(); e.stopPropagation();
            window.parent.postMessage({ type: 'CGA_ELEMENT_SELECTED', path: resolveExactPath(e.target), element: getElementInfo(e.target), outerHTML: e.target.outerHTML }, '*');
        }
    }, true);

    // 💡 MutationObserver
    let scanTimeout = null;
    const scheduleScan = (delay = 800) => {
        if (scanTimeout) clearTimeout(scanTimeout);
        scanTimeout = setTimeout(scanNextGap, delay);
    };

    const domObserver = new MutationObserver((mutations) => {
        let isRelevant = false;
        for (const m of mutations) {
            if (__cgaHoverBox && (m.target === __cgaHoverBox || m.target === __cgaHoverLabel)) continue;
            isRelevant = true; break;
        }
        if (isRelevant) scheduleScan(800);
    });
    
    window.addEventListener('load', () => {
        window.parent.postMessage({ type: 'CGA_ROUTE_CHANGED', path: window.location.pathname + window.location.search }, '*');
        scheduleScan(1500);
        domObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'href', 'src', 'alt'] });
    });
}
