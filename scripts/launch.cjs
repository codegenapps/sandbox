const {spawn, execSync} = require('child_process');
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

/**
 * 💡 決定性邏輯：這部分僅負責生成輔助檔案，不修改用戶代碼
 */
function ensureAuxiliaryFiles() {
    log("Ensuring auxiliary platform files...");
    
    // 1. 生成 CGA Inspector Babel Plugin
    const pluginCode = `
module.exports = function(babel) {
  const { types: t } = babel;
  return {
    name: "cga-source-mapping-plugin",
    visitor: {
      JSXOpeningElement(path, state) {
        const filename = state.file.opts.filename;
        if (!filename || filename.includes('node_modules') || filename.includes('.next') || filename.includes('.shadow')) return;
        const relativePath = filename.replace('/home/user/app', '');
        if (!path.node.attributes) return;
        const hasAttr = path.node.attributes.some(attr => t.isJSXAttribute(attr) && (attr.name.name === 'data-cga-path' || attr.name.name === 'data-cga-trace'));
        if (!hasAttr) {
          path.node.attributes.push(t.jsxAttribute(t.jsxIdentifier('data-cga-path'), t.stringLiteral(relativePath)));
        }
      }
    }
  };
};`;
    fs.writeFileSync(path.join(appDir, 'cga-plugin.cjs'), pluginCode);

    // 2. 如果是 Next.js，確保 .babelrc 存在 (因為 Next.js 優先讀取它)
    if (deps.next || scripts.dev?.includes('next dev')) {
        const babelRcPath = path.join(appDir, '.babelrc');
        if (!fs.existsSync(babelRcPath)) {
            fs.writeFileSync(babelRcPath, JSON.stringify({
                presets: ["next/babel"],
                plugins: ["./cga-plugin.cjs"]
            }, null, 2));
        }
    }
}

// 2. 決定啟動指令與參數
ensureAuxiliaryFiles();

let bin = '';
let args = [];

if (deps.next || scripts.dev?.includes('next dev')) {
    log("Detected Next.js project.");
    bin = path.join(appDir, 'node_modules/.bin/next');
    args = ['dev', '-H', '0.0.0.0', '-p', '3000'];
} else if (deps.vite || scripts.dev?.includes('vite')) {
    log("Detected Vite project.");
    bin = path.join(appDir, 'node_modules/.bin/vite');
    args = ['--host', '0.0.0.0', '--port', '3000'];
} else {
    log("Unknown project type. Falling back to 'npm run dev'.");
    bin = 'npm';
    args = ['run', 'dev', '--', '--host', '0.0.0.0', '--port', '3000'];
}

// 3. 防呆：確保執行檔存在
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
    VITE_HMR_PROTOCOL: 'wss'
  }
});

child.unref();
log("Server process detached. System ready.");
process.exit(0);