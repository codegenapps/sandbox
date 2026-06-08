const fs = require('fs');
const path = require('path');

/**
 * 🚀 通用型圖片物理優化腳本 v2.1 (Zero-Dependency Edition)
 * 移除 glob 依賴，使用原生 fs 實現，確保在任何沙盒環境直接運行。
 * 支援: React, Vue, Svelte, HTML, PHP
 */

const targetDir = path.join(process.cwd(), 'src');

/**
 * 原生遞歸遍歷檔案
 */
function getFiles(dir, allFiles = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const name = path.join(dir, file);
        if (fs.statSync(name).isDirectory()) {
            // 忽略 node_modules 和編譯目錄
            if (!file.includes('node_modules') && !file.includes('.next') && file !== 'dist') {
                getFiles(name, allFiles);
            }
        } else {
            // 過濾副檔名
            if (/\.(tsx|jsx|vue|html|php|svelte|astro)$/.test(file)) {
                allFiles.push(name);
            }
        }
    }
    return allFiles;
}

let modifiedCount = 0;
let totalImgCount = 0;

try {
    const files = getFiles(targetDir);
    console.log(`[Optimizer] Scanning ${files.length} files in /src (Zero-Dep Mode)...`);

    files.forEach(filePath => {
        let content = fs.readFileSync(filePath, 'utf8');
        let originalContent = content;

        // 🔍 匹配 <img> 標籤
        const imgRegex = /<img([\s\S]+?)\/?>/gi;
        
        content = content.replace(imgRegex, (match, attributes) => {
            totalImgCount++;
            let newAttrs = attributes;

            // 🟢 1. 一鍵 Lazy Load
            const hasLoading = /[\s\n](:?loading)=/.test(newAttrs);
            if (!hasLoading) {
                newAttrs = ` loading="lazy"${newAttrs}`;
            }

            // 🟢 2. 一鍵 Alt 補齊
            const hasAlt = /[\s\n](:?alt)=/.test(newAttrs);
            if (!hasAlt) {
                const srcMatch = newAttrs.match(/[:\w]*src=["']?([^"'\s>{}]+)["']?/);
                let altName = "image";
                
                if (srcMatch && srcMatch[1]) {
                    const fileName = srcMatch[1].split('/').pop().split('?')[0].split('.')[0];
                    if (fileName && fileName !== 'undefined' && !fileName.startsWith('http')) {
                        altName = fileName.replace(/[-_]/g, ' ');
                    }
                }
                newAttrs = `${newAttrs} alt="${altName}"`;
            }

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
} catch (err) {
    console.error(`[Fatal Error] ${err.message}`);
}
