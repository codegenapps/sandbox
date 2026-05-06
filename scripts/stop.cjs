const { execSync } = require('child_process');

console.log('>>> Shadow Engine: Stopping Next.js server...');

try {
    // 找出佔用 3000 port 的 PID 並殺死它
    execSync("fuser -k 3000/tcp || true");
    
    // 雙重保險：殺死所有包含 'next' 字樣的 node 進程
    execSync("pkill -9 -f next || true");
    
    console.log('>>> Shadow Engine: Server stopped.');
} catch (e) {
    console.error('>>> Shadow Engine: Stop failed:', e.message);
}

process.exit(0);