const { Project, SyntaxKind } = require('ts-morph');
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

// 2. 啟動 ts-morph
const project = new Project();
const sourceFile = project.addSourceFileAtPath(filePath);

// 3. 尋找目標 JSX 節點
let bestNode = null;
let highestScore = -1;

// 深度優先搜尋 JSX 元素
sourceFile.forEachDescendant(node => {
    const kind = node.getKind();
    if (kind === SyntaxKind.JsxOpeningElement || kind === SyntaxKind.JsxSelfClosingElement) {
        const tagName = node.getTagNameNode().getText().toLowerCase();
        
        if (tagName === targetTag) {
            let score = 0;
            let requiredChecks = 0;

            // 比對 ID (權重極高 100)
            if (targetId) {
                requiredChecks++;
                const idAttr = node.getAttribute('id');
                if (idAttr) {
                    const idVal = idAttr.getInitializer()?.getText().replace(/['"]/g, '');
                    if (idVal === targetId) score += 100;
                }
            }

            // 比對 Name (權重高 50)
            if (targetName) {
                requiredChecks++;
                const nameAttr = node.getAttribute('name');
                if (nameAttr) {
                    const nameVal = nameAttr.getInitializer()?.getText().replace(/['"]/g, '');
                    if (nameVal === targetName) score += 50;
                }
            }

            // 比對 Class (完全匹配 40, 部分包含 10)
            if (targetClass) {
                requiredChecks++;
                const classAttr = node.getAttribute('className') || node.getAttribute('class');
                if (classAttr) {
                    const actualClass = classAttr.getInitializer()?.getText().replace(/['"]/g, '') || "";
                    if (actualClass === targetClass) {
                        score += 40;
                    } else if (actualClass.includes(targetClass.split(' ')[0])) {
                        score += 10;
                    }
                }
            }

            // 判斷是否為最佳候選人：
            // 如果沒有任何額外屬性要求，標籤相符即給基礎分
            if (requiredChecks === 0) {
                score = 1;
            }

            if (score > 0 && score > highestScore) {
                highestScore = score;
                bestNode = node;
            }
        }
    }
});

// 4. 執行替換
if (bestNode) {
    const nodeToReplace = bestNode.getKind() === SyntaxKind.JsxOpeningElement 
        ? bestNode.getParent() 
        : bestNode;

    nodeToReplace.replaceWithText(newCode);
    sourceFile.saveSync();
    console.log("SUCCESS");
} else {
    console.log("AST_MISMATCH");
    process.exit(0);
}
