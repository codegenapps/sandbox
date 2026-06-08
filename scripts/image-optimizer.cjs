const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * 🚀 通用型圖片物理優化腳本 v2.0 (Framework Agnostic)
 * 支援: React (JSX/TSX), Vue, Svelte, HTML, PHP
 * 目的: 一鍵加固 Lazy Load 與 Alt 屬性，不消耗 AI Token。
 */

// 1. 定義掃描範圍：包含所有常見的前端模板格式
const targetDir = path.join(process.cwd(), 'src');
const files = glob.sync('**/*.{tsx,jsx,vue,html,php,svelte,astro}', { 
    cwd: targetDir, 
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**'] 
});

let modifiedCount = 0;
let totalImgCount = 0;

console.log(`[Optimizer] Scanning ${files.length} files in /src ...`);

files.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // 🔍 匹配 <img> 標籤 (不分框架，捕捉整個標籤內容)
    // 此正規表達式可應付換行、不同屬性順序以及單/雙引號
    const imgRegex = /<img([\s\S]+?)\/?>/gi;
    
    content = content.replace(imgRegex, (match, attributes) => {
        totalImgCount++;
        let newAttrs = attributes;

        // 🟢 1. 一鍵 Lazy Load (不分框架通用屬性)
        // 檢查是否已有 loading 屬性 (包含動態綁定如 :loading 或 v-bind:loading)
        const hasLoading = /[\s\n](:?loading)=/.test(newAttrs);
        if (!hasLoading) {
            newAttrs = ` loading="lazy"${newAttrs}`;
        }

        // 🟢 2. 一鍵 Alt 補齊
        const hasAlt = /[\s\n](:?alt)=/.test(newAttrs);
        if (!hasAlt) {
            // 嘗試提取圖片來源 (支援 src, :src, v-bind:src)
            const srcMatch = newAttrs.match(/[:\w]*src=["']?([^"'\s>{}]+)["']?/);
            let altName = "image";
            
            if (srcMatch && srcMatch[1]) {
                // 處理路徑，拿掉參數與副檔名
                const fileName = srcMatch[1].split('/').pop().split('?')[0].split('.')[0];
                if (fileName && fileName !== 'undefined' && !fileName.startsWith('http')) {
                    altName = fileName.replace(/[-_]/g, ' ');
                }
            }
            newAttrs = `${newAttrs} alt="${altName}"`;
        }

        // 保持標籤閉合格式 (維持原始風格)
        const isSelfClosing = match.endsWith('/>');
        return `<img${newAttrs}${isSelfClosing ? ' /' : ''}>`;
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        modifiedCount++;
        console.log(`[Fixed] ${path.relative(process.cwd(), filePath)}`);
    }
});

console.log(`\n✅ Optimization Report:`);
console.log(`- Total Images Processed: ${totalImgCount}`);
console.log(`- Files Modified: ${modifiedCount}`);
console.log(`- Frameworks Covered: React, Vue, Svelte, HTML`);
