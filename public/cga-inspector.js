/**
 * CGA Inspector - 核心偵測與通訊腳本
 * 作用：注入 Iframe，負責元素選取、API 拖放、品質掃描與父視窗通訊。
 */
if (typeof window !== 'undefined') {
    // ----------------------------------------------------------------------
    // 1. 全域狀態與設定
    // ----------------------------------------------------------------------
    window.__cgaConsoleHooked = window.__cgaConsoleHooked || false;
    window.__cgaSelectMode = false;
    window.__cgaDraggingApi = null;
    window.__cgaLastHighlighted = null;

    let __cgaHoverBox = null;
    let __cgaHoverLabel = null;
    let isScanningPaused = false;
    const scannedGaps = new Set();
    let currentHighlightedGapEl = null;

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

    // ----------------------------------------------------------------------
    // 2. 核心工具函式
    // ----------------------------------------------------------------------
    const clearGapHighlight = () => {
        if (currentHighlightedGapEl) {
            const el = currentHighlightedGapEl;
            el.style.outline = '';
            el.style.outlineOffset = '';
            el.style.backgroundColor = '';
            el.style.boxShadow = '';
            currentHighlightedGapEl = null;
        }
    };

    const getElementInfo = (target) => {
        if (!target) return "";
        const tag = target.tagName.toLowerCase();
        const id = target.id ? `#${target.id}` : '';
        const cls = typeof target.className === 'string' ? `.${target.className.split(' ').join('.')}` : '';
        let text = (target.innerText || '').replace(/\n/g, ' ').trim();
        if (text.length > 30) text = text.substring(0, 30) + '...';
        return `<${tag}${id}${cls}>${text}</${tag}>`;
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

    // ----------------------------------------------------------------------
    // 3. Quality Auditor (全功能偵測引擎)
    // ----------------------------------------------------------------------
    const scanNextGap = () => {
        if (isScanningPaused || !auditorConfig.enabled) return;

        // 1. SEO 偵測 (Meta / Title)
        if (auditorConfig.seoMeta) {
            const title = document.title;
            const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content');
            if (!title || title === 'React App' || !metaDesc) {
                const f = `SEO_${window.location.pathname}`;
                if (!scannedGaps.has(f)) {
                    isScanningPaused = true; scannedGaps.add(f);
                    window.parent.postMessage({ type: 'CGA_AURA_REPORT', payload: { fingerprint: f, category: "SEO_META", reason: "頁面缺乏有效的 Title 或 Meta Description 標籤", element: "document.head", path: window.location.pathname }}, '*');
                    return;
                }
            }
        }

        const selectors = [];
        if (auditorConfig.apiBinding) selectors.push('button', 'form');
        if (auditorConfig.deadLink) selectors.push('a');
        if (auditorConfig.imageAudit) selectors.push('img');
        if (auditorConfig.inputValidation) selectors.push('input:not([type="hidden"])', 'textarea');
        if (auditorConfig.darkMode) selectors.push('[class*="text-[#"]', '[class*="bg-[#"]');
        if (auditorConfig.staticList) selectors.push('ul', '.grid', '.flex');

        if (selectors.length > 0) {
            const candidates = document.querySelectorAll(selectors.join(', '));
            for (const el of candidates) {
                const safeClassName = typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '');
                const fingerprint = `${window.location.pathname}_${el.tagName}_${(el.innerText || el.src || el.href || '').trim().substring(0, 15)}_${safeClassName.substring(0, 10)}`;
                if (scannedGaps.has(fingerprint)) continue;

                const props = getFiberProps(el);
                let isUnbound = false;
                let reason = "";
                let category = "";

                // A. API 綁定
                if (auditorConfig.apiBinding) {
                    if (el.tagName === 'BUTTON' && (!props?.onClick || isNoop(props.onClick)) && !(props?.type === 'submit' && el.closest('form'))) {
                        isUnbound = true; category = "API_BINDING"; reason = "按鈕缺乏點擊功能";
                    } else if (el.tagName === 'FORM' && (!props?.onSubmit || isNoop(props.onSubmit))) {
                        isUnbound = true; category = "API_BINDING"; reason = "表單缺乏送出邏輯";
                    }
                }

                // B. 無效連結
                if (!isUnbound && auditorConfig.deadLink && el.tagName === 'A') {
                    const h = el.getAttribute('href');
                    if (!h || h === '#' || h.includes('javascript:void')) {
                        isUnbound = true; category = "DEAD_LINK"; reason = "超連結缺乏有效的路徑";
                    }
                }

                // C. 圖片 alt
                if (!isUnbound && auditorConfig.imageAudit && el.tagName === 'IMG' && !el.alt) {
                    isUnbound = true; category = "IMAGE_AUDIT"; reason = "圖片缺乏 alt 無障礙標籤";
                }

                // D. 輸入驗證
                if (!isUnbound && auditorConfig.inputValidation && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                    if (!el.hasAttribute('required') && el.closest('form')) {
                        isUnbound = true; category = "INPUT_VALIDATION"; reason = "輸入框在表單內缺乏 required 驗證";
                    }
                }

                // E. Dark Mode (Hex 色碼偵測)
                if (!isUnbound && auditorConfig.darkMode) {
                    if (safeClassName.match(/(text|bg)-\[#([0-9a-fA-F]{3,6})\]/)) {
                        isUnbound = true; category = "DARK_MODE"; reason = "使用硬編碼色碼，深色模式切換時可能失效";
                    }
                }

                // F. 靜態列表 (子元素重複性)
                if (!isUnbound && auditorConfig.staticList && el.children.length >= 3) {
                    const c = el.children;
                    if (c[0].tagName === c[1].tagName && c[1].tagName === c[2].tagName && c[0].className === c[1].className && c[0].className !== '') {
                        isUnbound = true; category = "STATIC_LIST"; reason = "發現高度重複的子元件，建議改用動態渲染 (map)";
                    }
                }

                if (isUnbound) {
                    isScanningPaused = true; scannedGaps.add(fingerprint);
                    clearGapHighlight();
                    el.style.outline = '2px dashed #3b82f6';
                    el.style.outlineOffset = '4px';
                    el.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                    currentHighlightedGapEl = el;
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    window.parent.postMessage({
                        type: 'CGA_AURA_REPORT',
                        payload: { fingerprint, category, reason, element: getElementInfo(el), path: resolveExactPath(el) }
                    }, '*');
                    return;
                }
            }
        }

        // G. 響應式溢出
        if (auditorConfig.responsive) {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            if (docWidth > winWidth + 5) { 
                const f = `OVERFLOW_${window.location.pathname}`;
                if (!scannedGaps.has(f)) {
                    isScanningPaused = true; scannedGaps.add(f);
                    window.parent.postMessage({ type: 'CGA_AURA_REPORT', payload: { fingerprint: f, category: "RESPONSIVE_OVERFLOW", reason: `頁面寬度 (${docWidth}px) 超出螢幕寬度 (${winWidth}px)`, element: "document.body", path: window.location.pathname }}, '*');
                }
            }
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
            window.parent.postMessage({ type: 'CGA_CONSOLE_LOG', level: 'error', payload: msg }, '*');
            if (auditorConfig.runtimeError && !isScanningPaused && !msg.includes('[CGA Inspector]')) {
                const f = `ERR_${msg.substring(0, 30)}`;
                if (!scannedGaps.has(f)) {
                    isScanningPaused = true; scannedGaps.add(f);
                    window.parent.postMessage({ type: 'CGA_AURA_REPORT', payload: { fingerprint: f, category: 'RUNTIME_ERROR', reason: '主控台發生錯誤', element: msg.substring(0, 100), path: window.location.pathname }}, '*');
                }
            }
            originalError(...args);
        };
    }

    window.addEventListener('message', (event) => {
        const { type, payload, enabled, path } = event.data || {};
        if (type === 'CGA_SET_SELECT_MODE') {
            window.__cgaSelectMode = !!enabled;
            if (!window.__cgaSelectMode && __cgaHoverBox) __cgaHoverBox.style.display = 'none';
        } else if (type === 'CGA_SET_AUDITOR_CONFIG') {
            auditorConfig = payload; isScanningPaused = false; clearGapHighlight(); scannedGaps.clear();
            if (auditorConfig.enabled) setTimeout(scanNextGap, 1000);
        } else if (type === 'CGA_RESUME_SCAN') {
            isScanningPaused = false; clearGapHighlight(); setTimeout(scanNextGap, 500);
        } else if (type === 'CGA_NAVIGATE') {
            if (path && path !== window.location.pathname) window.history.pushState(null, '', path);
        } else if (type === 'CGA_SCROLL_TO_GAP') {
            currentHighlightedGapEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (type === 'CGA_TAKE_SCREENSHOT') {
            // 此處需要 async，為了簡潔暫略或保持原本 load html-to-image 邏輯
        }
    });

    // Hover Box 邏輯
    const updateHoverBox = (target) => {
        if (!target || target === document.body || target === document.documentElement) {
            if (__cgaHoverBox) __cgaHoverBox.style.display = 'none';
            return;
        }
        if (!__cgaHoverBox) {
            __cgaHoverBox = document.createElement('div');
            __cgaHoverBox.style.cssText = "position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);display:none;";
            __cgaHoverLabel = document.createElement('div');
            __cgaHoverLabel.style.cssText = "position:absolute;top:0;left:0;background:#3b82f6;color:#fff;font-size:10px;padding:2px 6px;transform:translateY(-100%);";
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

    window.addEventListener('load', () => {
        window.parent.postMessage({ type: 'CGA_ROUTE_CHANGED', path: window.location.pathname + window.location.search }, '*');
        setTimeout(scanNextGap, 3000);
    });
}
