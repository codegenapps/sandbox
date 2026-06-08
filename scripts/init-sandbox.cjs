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
        const isEnvOnly = process.argv.includes('--env-only');

        // 1. 清理可能干擾的舊快取
        if (!isEnvOnly && fs.existsSync('/home/user/app/.next')) fs.rmSync('/home/user/app/.next', { recursive: true, force: true });
        
        // 2. 獨立獲取 API Key 
        log('>>> Syncing API Key...');
        const keyRes = await fetch(adminApiUrl + '/projects/' + pid + '/api-key', token);
        const apiKey = (keyRes.data && keyRes.data.api_key) ? keyRes.data.api_key : '';

        if (isEnvOnly) {
            log('>>> Mode: ENV ONLY. Updating .env.local only...');
            writeEnv(projectApiUrl, apiKey, projectDocUrl, token);
            log('>>> Environment updated. Skipping snapshot restoration.');
            return;
        }

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
    
    log('>>> Generating TypeScript API SDK from schema (Single File Mode)...');
    try {
        // 1. 執行生成器 (產出到 apiDir/generated 目錄)
        const genDir = path.join(apiDir, 'generated');
        // 💡 確保生成前清空舊的碎檔案，避免殘留的 modular 檔案混淆
        if (fs.existsSync(genDir)) fs.rmSync(genDir, { recursive: true, force: true });
        fs.mkdirSync(genDir, { recursive: true });
        
        // 💡 移除 --modular，改用單一檔案模式 (-n Api.ts)
        const schemaPath = path.join(apiDir, 'schema.json');
        execSync(`npx swagger-typescript-api generate -p ${schemaPath} -o ${genDir} -n Api.ts --axios --route-types --unwrap-response-data`, { stdio: 'pipe' });
        
        log('>>> API SDK generated successfully.');
        
    } catch (err) {
        log('>>> [Warning] Failed to generate API SDK: ' + (err.stderr ? err.stderr.toString() : err.message));
    }
}

function writeEnv(apiUrl, apiKey, docUrl, token) {
    const envPath = '/home/user/app/.env.local';
    let existingEnv = {};

    // 1. 嘗試讀取現有的 .env.local 並解析
    if (fs.existsSync(envPath)) {
        try {
            const content = fs.readFileSync(envPath, 'utf8');
            content.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    existingEnv[key.trim()] = valueParts.join('=').trim();
                }
            });
            log('>>> Parsed existing .env.local for merging.');
        } catch (e) {
            log('>>> [Warning] Failed to parse existing .env.local: ' + e.message);
        }
    }

    // 2. 定義系統管理的變數 (這些會被強制更新)
    const systemVars = {
        'NEXT_PUBLIC_CGA_API_URL': apiUrl,
        'NEXT_PUBLIC_CGA_API_KEY': apiKey,
        'NEXT_PUBLIC_CGA_DOC_URL': docUrl,
        'VITE_CGA_API_URL': apiUrl,
        'VITE_CGA_API_KEY': apiKey,
        'VITE_CGA_DOC_URL': docUrl,
        'CGA_ACCESS_TOKEN': token
    };

    if (process.env.GITHUB_ACCESS_TOKEN) {
        systemVars['GITHUB_ACCESS_TOKEN'] = process.env.GITHUB_ACCESS_TOKEN;
    }

    // 3. 合併：系統變數覆蓋舊變數，其餘保留
    const mergedEnv = { ...existingEnv, ...systemVars };

    // 4. 序列化並寫回
    let envString = '# --- System Managed Variables (Auto-Updated) ---\n';
    Object.keys(systemVars).forEach(key => {
        envString += `${key}=${systemVars[key]}\n`;
    });

    const userKeys = Object.keys(mergedEnv).filter(key => !Object.keys(systemVars).includes(key));
    if (userKeys.length > 0) {
        envString += '\n# --- User Defined Variables (Preserved) ---\n';
        userKeys.forEach(key => {
            envString += `${key}=${mergedEnv[key]}\n`;
        });
    }

    fs.writeFileSync(envPath, envString.trim() + '\n');
    log('>>> .env.local updated with smart merging.');
}

init().catch(console.error);