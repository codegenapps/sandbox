const {spawn, execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const logPath = '/home/user/app/server.log';
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
    const isNext = deps.next || scripts.dev?.includes('next dev');
    const isVite = deps.vite || scripts.dev?.includes('vite');

    log("Ensuring auxiliary platform files...");
    
    if (isVite) {
        log("Vite detected: Generating cga-plugin.cjs for source mapping...");
        const pluginCode = `
module.exports = function(babel) {
  const { types: t } = babel;
  return {
    name: "cga-source-mapping-plugin",
    visitor: {
      JSXOpeningElement(path, state) {
        const filename = state.file.opts.filename;
        if (!filename || filename.includes('node_modules') || filename.includes('.next') || filename.includes('.shadow')) return;
        
        // 💡 阻擋 Fragment，避免 Invalid prop warning
        const nameNode = path.node.name;
        if (
            (nameNode.type === "JSXIdentifier" && nameNode.name === "Fragment") ||
            (nameNode.type === "JSXMemberExpression" && nameNode.object.name === "React" && nameNode.property.name === "Fragment")
        ) {
            return;
        }

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
    }

    if (isNext) {
        log("Next.js detected: Skipping .babelrc to preserve SWC compiler (Stability Protection).");
        // 💡 主動檢查並清理可能殘留的 .babelrc，避免 Next.js 崩潰
        const babelRcPath = path.join(appDir, '.babelrc');
        if (fs.existsSync(babelRcPath)) {
            const content = fs.readFileSync(babelRcPath, 'utf8');
            if (content.includes('cga-plugin.cjs')) {
                log("Removing incompatible legacy .babelrc...");
                fs.unlinkSync(babelRcPath);
            }
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
    const devScript = scripts.dev || "";
    if (devScript.includes('serve')) {
        args = ['run', 'dev'];
    } else {
        args = ['run', 'dev', '--', '--host', '0.0.0.0', '--port', '3000'];
    }
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