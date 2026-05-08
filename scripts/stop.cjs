const { execSync } = require('child_process');

console.log('>>> Shadow Engine: Termination protocol initiated (Port 3000)...');

try {
    // 1. 核心策略：殺死所有佔用 3000 port 的行程 (不分框架)
    execSync("fuser -k 3000/tcp || true");
    
    // 2. 輔助策略：針對常見框架名稱執行強制清理
    // 殺死包含 'next' 或 'vite' 字樣的所有 node 行程
    execSync("pkill -9 -f next || true");
    execSync("pkill -9 -f vite || true");
    
    // 3. 確保 node 殘留行程也被清理 (若仍有專案啟動失敗殘留)
    // 這裡謹慎使用，僅針對開發模式常見的關鍵字
    execSync("pkill -9 -f 'node.*dev' || true");
    
    console.log('>>> Shadow Engine: Server stopped.');
} catch (e) {
    console.error('>>> Shadow Engine: Stop failed:', e.message);
}

process.exit(0);
