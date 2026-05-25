const fs = require('fs');
const path = require('path');

/**
 * CGA Static Build Engine
 * 作用：將純 HTML 專案的源碼打包至 ./out 目錄，實現與 Next.js/Vite 一致的部署規範。
 */

const appDir = '/home/user/app';
const outDir = path.join(appDir, 'out');

console.log('>>> [Static Build]: Starting artifact packaging...');

try {
    // 1. 清理舊的 out 目錄
    if (fs.existsSync(outDir)) {
        fs.rmSync(outDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outDir);

    // 2. 定義要排除的檔案/目錄 (系統檔案、依賴項等)
    const ignored = [
        'node_modules',
        'out',
        'dist',
        '.git',
        '.cga',
        '.shadow',
        '.env.local',
        'package.json',
        'package-lock.json',
        'server.log',
        'sync.log'
    ];

    // 3. 執行智慧複製
    const files = fs.readdirSync(appDir);
    let count = 0;

    files.forEach(file => {
        if (!ignored.includes(file)) {
            const srcPath = path.join(appDir, file);
            const destPath = path.join(outDir, file);
            
            fs.cpSync(srcPath, destPath, { recursive: true });
            count++;
        }
    });

    console.log(`>>> [Static Build]: Success! ${count} items packaged into ./out`);
    process.exit(0);
} catch (err) {
    console.error('>>> [Static Build]: Failed -', err.message);
    process.exit(1);
}
