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

        // 4. 核心還原邏輯
        if (snapshotUrl && snapshotUrl !== "null" && snapshotUrl !== "") {
            log('>>> Case: EXISTING PROJECT. Restoring from ZIP Snapshot...');
            try {
                // 下載並覆蓋，但不刪除 node_modules
                execSync(`curl -sL "${snapshotUrl}" -o /tmp/snapshot.zip && unzip -o /tmp/snapshot.zip -d /home/user/app/ && rm /tmp/snapshot.zip`, { stdio: 'inherit' });
                log('>>> Artifacts extracted successfully.');
                
                // 補上動態生成的環境檔案
                writeEnv(projectApiUrl, apiKey, projectDocUrl, token);
                if (!fs.existsSync('/home/user/app/api')) fs.mkdirSync('/home/user/app/api', { recursive: true });
                fs.writeFileSync('/home/user/app/api/schema.json', schemaContent);
                
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
            if (!fs.existsSync('/home/user/app/api')) fs.mkdirSync('/home/user/app/api', { recursive: true });
            fs.writeFileSync('/home/user/app/api/schema.json', schemaContent);
        }

        log('>>> Initialization successful.');
    } catch (e) {
        log('>>> [FATAL] Init Failed: ' + e.message);
        process.exit(1);
    }
}

function writeEnv(apiUrl, apiKey, docUrl, token) {
    let env = 'NEXT_PUBLIC_CGA_API_URL=' + apiUrl + '\n' +
                'NEXT_PUBLIC_CGA_API_KEY=' + apiKey + '\n' +
                'NEXT_PUBLIC_CGA_DOC_URL=' + docUrl + '\n' +
                'CGA_ACCESS_TOKEN=' + token + '\n' + // 💡 確保後端 AI 工具能讀到管理員 Token
                'NEXT_PUBLIC_IS_SANDBOX=true\n';
    if (process.env.GITHUB_ACCESS_TOKEN) {
        env += 'GITHUB_ACCESS_TOKEN=' + process.env.GITHUB_ACCESS_TOKEN + '\n';
    }
    fs.writeFileSync('/home/user/app/.env.local', env);
}

init().catch(console.error);