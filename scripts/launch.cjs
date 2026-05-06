const { spawn, execSync } = require('child_process');
const fs = require('fs');

const logPath = '/home/user/app/next.log';
const log = fs.openSync(logPath, 'a');
const out = fs.openSync(logPath, 'a');

// 防呆：確保 dependencies 已安裝
if (!fs.existsSync('/home/user/app/node_modules/next')) {
    fs.appendFileSync(logPath, "\n[System] node_modules/next not found. Running npm install...\n");
    try {
        execSync('npm install --legacy-peer-deps', { stdio: 'ignore', cwd: '/home/user/app' });
    } catch (e) {
        fs.appendFileSync(logPath, "[Error] Emergency install failed.\n");
    }
}

// 優先使用本地的 next 二進位檔
const nextBin = '/home/user/app/node_modules/.bin/next';
const args = ['dev', '-H', '0.0.0.0', '-p', '3000'];

const child = spawn(nextBin, args, {
  cwd: '/home/user/app',
  detached: true,
  stdio: ['ignore', out, log]
});

child.unref();
process.exit(0);