const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const logPath = '/home/user/app/next.log';
const logFile = fs.openSync(logPath, 'a');
const outFile = fs.openSync(logPath, 'a');

const appDir = '/home/user/app';
const pkgPath = path.join(appDir, 'package.json');

function log(msg) {
    fs.appendFileSync(logPath, `[System] ${msg}\n`);
    console.log(msg);
}

// 1. 讀取 package.json 偵測專案類型
let pkg = {};
if (fs.existsSync(pkgPath)) {
    try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (e) {
        log("Failed to parse package.json");
    }
}

const scripts = pkg.scripts || {};
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

// 💡 動態注入：DOM to Source Mapping (CGA Inspector 專用)
function injectNextJsSourceMap() {
    log("Injecting CGA Source Map for Next.js...");
    const pluginCode = `
module.exports = function(babel) {
  const { types: t } = babel;
  return {
    name: "cga-source-mapping-plugin",
    visitor: {
      JSXOpeningElement(path, state) {
        const filename = state.file.opts.filename;
        if (!filename || filename.includes('node_modules') || filename.includes('.next')) return;
        const relativePath = filename.replace('/home/user/app', '');
        const hasAttr = path.node.attributes.some(attr => t.isJSXAttribute(attr) && attr.name.name === 'data-cga-path');
        if (!hasAttr) {
          path.node.attributes.push(t.jsxAttribute(t.jsxIdentifier('data-cga-path'), t.stringLiteral(relativePath)));
        }
      }
    }
  };
};`;
    fs.writeFileSync(path.join(appDir, 'cga-plugin.js'), pluginCode);
    
    // 如果沒有 babel 設定，建立一個；如果有，則假設使用者自己控制
    const babelRcPath = path.join(appDir, '.babelrc');
    if (!fs.existsSync(babelRcPath)) {
        fs.writeFileSync(babelRcPath, JSON.stringify({
            presets: ["next/babel"],
            plugins: ["./cga-plugin.js"]
        }, null, 2));
    }
}

function injectViteSourceMap() {
    log("Injecting CGA Source Map for Vite...");
    // Vite 的 @vitejs/plugin-react 本身就內建了 babel-plugin-transform-react-jsx-source
    // 只要確保環境變數 NODE_ENV 是 development，Vite 預設就會幫 DOM 加上 __source 屬性
    // 我們不需要寫 plugin，只需要確保 cga-inspector.js 知道去讀 __source 即可。
    log("Vite automatically provides __source in development mode.");
}

// 2. 決定啟動指令與參數，並注入對應配置
let bin = '';
let args = [];

if (deps.next || scripts.dev?.includes('next dev')) {
    log("Detected Next.js project.");
    injectNextJsSourceMap();
    bin = path.join(appDir, 'node_modules/.bin/next');
    args = ['dev', '-H', '0.0.0.0', '-p', '3000'];
} else if (deps.vite || scripts.dev?.includes('vite')) {
    log("Detected Vite project.");
    injectViteSourceMap();
    bin = path.join(appDir, 'node_modules/.bin/vite');
    // Vite 需要 --host 才能在容器外訪問
    args = ['--host', '0.0.0.0', '--port', '3000'];
} else {
    log("Unknown project type. Falling back to 'npm run dev'.");
    bin = 'npm';
    args = ['run', 'dev', '--', '--host', '0.0.0.0', '--port', '3000'];
}

// 3. 防呆：確保執行檔存在，不存在就緊急安裝
if (bin !== 'npm' && !fs.existsSync(bin)) {
    log(`${bin} not found. Running emergency npm install...`);
    try {
        execSync('npm install --legacy-peer-deps', { stdio: 'ignore', cwd: appDir });
    } catch (e) {
        log("[Error] Emergency install failed.");
    }
}

// 4. 啟動伺服器
log(`Launching: ${bin} ${args.join(' ')}`);

const child = spawn(bin, args, {
  cwd: appDir,
  detached: true,
  stdio: ['ignore', outFile, logFile],
  env: {
    ...process.env,
    NODE_ENV: 'development',
    // 解決 Vite 在某些環境下無法偵測到 HMR 端口的問題
    VITE_HMR_PROTOCOL: 'wss'
  }
});

child.unref();
log("Server process detached. System ready.");
process.exit(0);