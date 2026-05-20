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
        return exactPath || window.location.pathname;
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
        const fiberKey = Object.keys(target).find(key => key.startsWith('__reactFiber$'));
        if (!fiberKey) return null;
        return target[fiberKey]?.memoizedProps || target[fiberKey]?.pendingProps;
    };

    const isNoop = (fn) => {
        if (!fn || typeof fn !== 'function') return true;
        const str = fn.toString().replace(/\s/g, '');
        return str.includes('()=>{}') || str.includes('()=>console.log(') || str.includes('function(){}');
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
            const candidates = document.querySelectorAll(selectors.join(', '));

            for (const el of candidates) {
                const fingerprint = `${window.location.pathname}_${el.tagName}_${(el.innerText || el.src || el.href || '').trim().substring(0, 15)}_${el.className.substring(0, 10)}`;
                if (scannedGaps.has(fingerprint)) continue;

                const props = getFiberProps(el);
                let isUnbound = false;
                let reason = "";
                let category = "";

                if (auditorConfig.apiBinding) {
                    if (el.tagName === 'BUTTON') {
                        if (!props?.onClick || isNoop(props.onClick)) {
                            if (!(props?.type === 'submit' && el.closest('form'))) {
                                isUnbound = true;
                                category = "API_BINDING";
                                reason = "按鈕缺乏點擊功能";
                            }
                        }
                    } else if (el.tagName === 'FORM') {
                        if (!props?.onSubmit || isNoop(props.onSubmit)) {
                            isUnbound = true;
                            category = "API_BINDING";
                            reason = "表單缺乏送出邏輯";
                        }
                    }
                }

                if (!isUnbound && auditorConfig.deadLink && el.tagName === 'A') {
                    const href = el.getAttribute('href');
                    if (!href || href === '#' || href.includes('javascript:void')) {
                        isUnbound = true;
                        category = "DEAD_LINK";
                        reason = "超連結缺乏有效的 href 路徑";
                    }
                }

                if (!isUnbound && auditorConfig.imageAudit && el.tagName === 'IMG') {
                    const alt = el.getAttribute('alt');
                    if (alt === null || alt.trim() === '') {
                        isUnbound = true;
                        category = "IMAGE_AUDIT";
                        reason = "圖片缺乏 alt 無障礙標籤";
                    }
                }

                if (!isUnbound && auditorConfig.inputValidation && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
                    const hasRequired = el.hasAttribute('required');
                    const hasPattern = el.hasAttribute('pattern');
                    if (!hasRequired && !hasPattern && el.closest('form')) {
                        isUnbound = true;
                        category = "INPUT_VALIDATION";
                        reason = "輸入框缺乏 required 屬性或基礎驗證規範";
                    }
                }

                if (!isUnbound && auditorConfig.darkMode) {
                    const cls = typeof el.className === 'string' ? el.className : '';
                    if (cls.includes('text-[#') || cls.includes('bg-[#') || (cls.includes('text-black') && !cls.includes('dark:text-'))) {
                        isUnbound = true;
                        category = "DARK_MODE";
                        reason = "使用強制色碼，深色模式切換時可能難以閱讀";
                    }
                }

                if (!isUnbound && auditorConfig.staticList && (el.tagName === 'UL' || (typeof el.className === 'string' && (el.className.includes('grid') || el.className.includes('flex'))))) {
                    const children = el.children;
                    if (children.length >= 3) {
                        const c1 = children[0], c2 = children[1], c3 = children[2];
                        if (c1.tagName === c2.tagName && c2.tagName === c3.tagName && c1.className === c2.className && c1.className !== '') {
                            isUnbound = true;
                            category = "STATIC_LIST";
                            reason = "發現多個結構高度重複的子元件，疑似未採用動態渲染";
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

                    // el.scrollIntoView({behavior: 'smooth', block: 'center'});

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
                    return;
                }
            }
        }

        if (auditorConfig.responsive) {
            const docWidth = document.documentElement.scrollWidth;
            const winWidth = window.innerWidth;
            if (docWidth > winWidth + 10) {
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
            setTimeout(scanNextGap, 1000);
        } else if (event.data?.type === 'CGA_NAVIGATE') {
            // 💡 接收到導航指令時，使用 History API 進行無縫換頁 (SPA)
            if (event.data.path && event.data.path !== window.location.pathname) {
                window.history.pushState(null, '', event.data.path);
            }
        } else if (event.data?.type === 'CGA_SCROLL_TO_GAP') {
            if (currentHighlightedGapEl) {
                currentHighlightedGapEl.scrollIntoView({behavior: 'smooth', block: 'center'});
            }
        } else if (event.data?.type === 'CGA_SET_AUDITOR_CONFIG') {
            const oldConfigStr = JSON.stringify(auditorConfig);
            const newConfigStr = JSON.stringify(event.data.payload);

            if (oldConfigStr !== newConfigStr) {
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
