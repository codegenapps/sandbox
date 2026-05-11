const fs = require('fs');
const https = require('https');
const http = require('http');

const logPath = '/home/user/app/sync.log';
const log = (msg) => {
    fs.appendFileSync(logPath, "[" + new Date().toISOString() + "] " + msg + '\n');
    console.log(msg);
};

const fetch = (url, token) => new Promise((resolve, reject) => {
    log('[Fetch] ' + url);
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            if (res.statusCode >= 400) return reject(new Error('HTTP ' + res.statusCode));
            try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
        });
    }).on('error', reject);
});

async function init() {
    fs.writeFileSync(logPath, '--- Shadow Engine Initializing (ZIP Artifact Mode) ---\n');
    try {
        const adminApiUrl = process.env.CGA_ADMIN_API_URL || process.env.NEXT_PUBLIC_CGA_API_URL;
        const projectDocUrl = process.env.NEXT_PUBLIC_CGA_DOC_URL;
        const token = process.env.CGA_ACCESS_TOKEN;
        const pid = process.env.PROJECT_ID;
        const wid = process.env.WEBBUILDER_ID;
        const projectApiUrl = projectDocUrl ? projectDocUrl.replace('/swagger/doc.json', '/api') : '';

        // 1. 清理可能干擾的舊快取
        if (fs.existsSync('/home/user/app/.next')) fs.rmSync('/home/user/app/.next', { recursive: true, force: true });
        
        // 2. 獨立獲取 API Key 
        log('>>> Syncing API Key...');
        const keyRes = await fetch(adminApiUrl + '/projects/' + pid + '/api-key', token);
        const apiKey = (keyRes.data && keyRes.data.api_key) ? keyRes.data.api_key : '';

        // 3. 獲取專案完整 Metadata (包含 ZIP URL)
        log('>>> Syncing Project Metadata from Backend...');
        const projectRes = await fetch(adminApiUrl + '/projects/' + pid + '/web-builders/' + wid, token);
        const projectData = projectRes.data || projectRes;
        const snapshotUrl = projectData.download_url || ""; // 💡 使用後端指定的 download_url

        // 3. 預抓取 Schema
        let schemaContent = "{}";
        try {
            if (projectDocUrl) {
                const schemaRes = await fetch(projectDocUrl, token);
                schemaContent = JSON.stringify(schemaRes);
            }
        } catch(e) { log('>>> [Warning] Failed to fetch schema.'); }

        const { execSync } = require('child_process');

        // 💡 智慧目錄判斷：配合 lifecycle.go 的動態注入路徑
        const hasSrc = fs.existsSync('/home/user/app/src');
        const apiDir = hasSrc ? '/home/user/app/src/api' : '/home/user/app/api';

        // 4. 核心還原邏輯
        if (snapshotUrl && snapshotUrl !== "null" && snapshotUrl !== "") {
            log('>>> Case: EXISTING PROJECT. Restoring from ZIP Snapshot...');
            try {
                // 下載並覆蓋，但不刪除 node_modules
                execSync(`curl -sL "${snapshotUrl}" -o /tmp/snapshot.zip && unzip -o /tmp/snapshot.zip -d /home/user/app/ && rm /tmp/snapshot.zip`, { stdio: 'inherit' });
                log('>>> Artifacts extracted successfully.');
                
                // 補上動態生成的環境檔案
                writeEnv(projectApiUrl, apiKey, projectDocUrl, token);
                if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });
                fs.writeFileSync(`${apiDir}/schema.json`, schemaContent);
                
                // 💡 動態生成強型別 API SDK
                generateApiSdk(apiDir, schemaContent);
                
                log('>>> Ensuring dependencies are ready...');
                try { execSync('npm install --legacy-peer-deps', { cwd: '/home/user/app', stdio: 'inherit' }); } catch(err) {}

            } catch (err) {
                log('>>> [Fatal Error] Failed to restore from ZIP snapshot: ' + err.message);
                throw err;
            }
        } else {
            log('>>> Case: NEW PROJECT. Initializing environment variables & API schema...');
            // 💡 在全 Git 驅動架構下，不需要再生任何 boilerplate，只要寫入動態變數即可
            writeEnv(projectApiUrl, apiKey, projectDocUrl, token);
            if (!fs.existsSync(apiDir)) fs.mkdirSync(apiDir, { recursive: true });
            fs.writeFileSync(`${apiDir}/schema.json`, schemaContent);
            
            // 💡 動態生成強型別 API SDK
            generateApiSdk(apiDir, schemaContent);
        }

        log('>>> Initialization successful.');
    } catch (e) {
        log('>>> [FATAL] Init Failed: ' + e.message);
        process.exit(1);
    }
}

function generateApiSdk(apiDir, schemaContent) {
    if (schemaContent.length < 10) return; // 沒有有效的 schema 就不生成
    const { execSync } = require('child_process');
    const fs = require('fs');
    const path = require('path');
    
    log('>>> Generating TypeScript API SDK from schema...');
    try {
        // 1. 執行生成器 (產出到 apiDir/generated 目錄)
        const genDir = path.join(apiDir, 'generated');
        if (!fs.existsSync(genDir)) fs.mkdirSync(genDir, { recursive: true });
        
        // 💡 修正關鍵：最新版 swagger-typescript-api 必須加上 "generate" 指令
        const schemaPath = path.join(apiDir, 'schema.json');
        execSync(`npx swagger-typescript-api generate -p ${schemaPath} -o ${genDir} --axios --modular --route-types --unwrap-response-data`, { stdio: 'pipe' });
        
        // 2. 自動產生中央註冊表 (index.ts)
        const files = fs.readdirSync(genDir).filter(f => f.endsWith('.ts') && f !== 'http-client.ts' && f !== 'data-contracts.ts');
        
        let imports = `import axios from 'axios';\n`;
        let exports = `export const api = {\n`;
        
        files.forEach(file => {
            const className = file.replace('.ts', '');
            imports += `import { ${className} } from './generated/${className}';\n`;
            // 將大寫開頭的 ClassName 轉為小寫開頭的屬性名 (例如 Users -> users)
            const propName = className.charAt(0).toLowerCase() + className.slice(1);
            exports += `  ${propName}: new ${className}({ instance: axiosInstance }),\n`;
        });
        exports += `};\n`;
        
        const setupContent = `${imports}

// 💡 智慧環境變數讀取：避免使用動態 key (import.meta.env[key])，因為 Vite 必須靜態替換字串
const getApiUrl = () => {
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_CGA_API_URL) return process.env.NEXT_PUBLIC_CGA_API_URL;
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.NEXT_PUBLIC_CGA_API_URL) return import.meta.env.NEXT_PUBLIC_CGA_API_URL;
  return '';
};

const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env && process.env.NEXT_PUBLIC_CGA_API_KEY) return process.env.NEXT_PUBLIC_CGA_API_KEY;
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.NEXT_PUBLIC_CGA_API_KEY) return import.meta.env.NEXT_PUBLIC_CGA_API_KEY;
  return '';
};

const axiosInstance = axios.create({
  baseURL: getApiUrl(),
});

// 自動攔截並注入 Token 與 API Key
axiosInstance.interceptors.request.use((config) => {
  let token = '';
  // 嘗試從 localStorage 或 sessionStorage 拿 token (適應大部分前端環境)
  if (typeof window !== 'undefined') {
      token = localStorage.getItem('token') || sessionStorage.getItem('token') || localStorage.getItem('access_token') || '';
  }
  
  if (token) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }

  // 🌟 注入全域 API KEY (重要：用於 Login 與基礎授權)
  const apiKey = getApiKey();
  if (apiKey) {
      config.headers['x-api-key'] = apiKey;
  }
  
  return config;
});

${exports}
`;
        fs.writeFileSync(path.join(apiDir, 'index.ts'), setupContent);
        log('>>> API SDK and Central Registry (api/index.ts) generated successfully.');
        
    } catch (err) {
        log('>>> [Warning] Failed to generate API SDK: ' + (err.stderr ? err.stderr.toString() : err.message));
    }
}

function writeEnv(apiUrl, apiKey, docUrl, token) {
    let env = 'NEXT_PUBLIC_CGA_API_URL=' + apiUrl + '\n' +
                'NEXT_PUBLIC_CGA_API_KEY=' + apiKey + '\n' +
                'NEXT_PUBLIC_CGA_DOC_URL=' + docUrl + '\n' +
                'CGA_ACCESS_TOKEN=' + token + '\n';
    if (process.env.GITHUB_ACCESS_TOKEN) {
        env += 'GITHUB_ACCESS_TOKEN=' + process.env.GITHUB_ACCESS_TOKEN + '\n';
    }
    fs.writeFileSync('/home/user/app/.env.local', env);
}

init().catch(console.error);