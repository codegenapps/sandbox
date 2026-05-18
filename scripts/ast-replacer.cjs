const { Project, SyntaxKind, ScriptTarget } = require('ts-morph');
const ts = require('typescript');
const fs = require('fs');

/**
 * AST 精準替換引擎 (Sandbox 版)
 * 用法: node ast-replacer.cjs <filePath> <targetSignature> <newCodeBase64> [--base64]
 */

const filePath = process.argv[2];
let targetSignature = process.argv[3];
const newCodeBase64 = process.argv[4];
const isBase64Mode = process.argv[5] === '--base64';

if (!filePath || !targetSignature || !newCodeBase64) {
    console.error("Usage: node ast-replacer.cjs <filePath> <targetSignature> <newCodeBase64> [--base64]");
    process.exit(1);
}

// 💡 支援 DNA 特徵的解碼
if (isBase64Mode) {
    targetSignature = Buffer.from(targetSignature, 'base64').toString('utf8');
}

const newCode = Buffer.from(newCodeBase64, 'base64').toString('utf8');

// 1. 解析目標特徵 (DNA)
const tagMatch = targetSignature.match(/^<([a-z0-9]+)/i);
const idMatch = targetSignature.match(/id="([^"]+)"/);
const classMatch = targetSignature.match(/class="([^"]+)"/);
const nameMatch = targetSignature.match(/name="([^"]+)"/);

const targetTag = tagMatch ? tagMatch[1].toLowerCase() : null;
const targetId = idMatch ? idMatch[1] : null;
const targetClass = classMatch ? classMatch[1] : null;
const targetName = nameMatch ? nameMatch[1] : null;

if (!targetTag) {
    console.error("PARSE_ERROR: Invalid target signature DNA.");
    process.exit(1);
}

// 2. 啟動 ts-morph (使用極致寬鬆模式進行節點定位)
const project = new Project({
    compilerOptions: { target: ScriptTarget.ESNext, jsx: 1, noResolve: true, skipLibCheck: true },
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    useInMemoryFileSystem: false
});
const sourceFile = project.addSourceFileAtPath(filePath);

// 3. 尋找目標 JSX 節點
let bestNode = null;
let highestScore = -1;

sourceFile.forEachDescendant(node => {
    const kind = node.getKind();
    if (kind === SyntaxKind.JsxOpeningElement || kind === SyntaxKind.JsxSelfClosingElement) {
        const tagName = node.getTagNameNode().getText().toLowerCase();
        if (tagName === targetTag) {
            let score = 0;
            let requiredChecks = 0;
            if (targetId) {
                requiredChecks++;
                const idAttr = node.getAttribute('id');
                if (idAttr) {
                    const idVal = idAttr.getInitializer()?.getText().replace(/['"]/g, '');
                    if (idVal === targetId) score += 100;
                }
            }
            if (targetName) {
                requiredChecks++;
                const nameAttr = node.getAttribute('name');
                if (nameAttr) {
                    const nameVal = nameAttr.getInitializer()?.getText().replace(/['"]/g, '');
                    if (nameVal === targetName) score += 50;
                }
            }
            if (targetClass) {
                requiredChecks++;
                const classAttr = node.getAttribute('className') || node.getAttribute('class');
                if (classAttr) {
                    const actualClass = classAttr.getInitializer()?.getText().replace(/['"]/g, '') || "";
                    if (actualClass === targetClass) score += 40;
                    else if (actualClass.includes(targetClass.split(' ')[0])) score += 10;
                }
            }
            if (requiredChecks === 0) score = 1;
            if (score > 0 && score > highestScore) {
                highestScore = score;
                bestNode = node;
            }
        }
    }
});

// 4. 執行替換與語法校驗
if (bestNode) {
    const nodeToReplace = bestNode.getKind() === SyntaxKind.JsxOpeningElement ? bestNode.getParent() : bestNode;
    const originalText = sourceFile.getFullText();
    
    // 先在內存中替換
    nodeToReplace.replaceWithText(newCode);
    const updatedText = sourceFile.getFullText();

    // 🔬 極限防禦：改用原生 TypeScript 解析器檢查語法，避開 ts-morph 的 flags 崩潰
    const sf = ts.createSourceFile(filePath, updatedText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const diagnostics = sf.parseDiagnostics;

    if (diagnostics && diagnostics.length > 0) {
        const errors = diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);
        if (errors.length > 0) {
            console.log("SYNTAX_ERROR: " + errors[0].messageText);
            process.exit(0);
        }
    }

    // 驗證通過，正式寫入磁碟
    fs.writeFileSync(filePath, updatedText);
    console.log("SUCCESS");
} else {
    console.log("AST_MISMATCH");
    process.exit(0);
}
