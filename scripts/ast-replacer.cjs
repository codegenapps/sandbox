const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

/**
 * AST 精準替換引擎 (Sandbox 版)
 * 用法: node ast-replacer.cjs <filePath> <targetSignature> <newCodeBase64>
 */

const filePath = process.argv[2];
const targetSignature = process.argv[3]; // 例如 "<form id=\"contact\" class=\"flex\">"
const newCodeBase64 = process.argv[4];

if (!filePath || !targetSignature || !newCodeBase64) {
    console.error("Usage: node ast-replacer.cjs <filePath> <targetSignature> <newCodeBase64>");
    process.exit(1);
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
let foundNode = null;

// 深度優先搜尋 JSX 元素
sourceFile.forEachDescendant(node => {
    if (foundNode) return;

    const kind = node.getKind();
    if (kind === SyntaxKind.JsxOpeningElement || kind === SyntaxKind.JsxSelfClosingElement) {
        const tagName = node.getTagNameNode().getText().toLowerCase();
        
        if (tagName === targetTag) {
            let score = 0;
            let requiredScore = 0;

            // 比對 ID (權重最高)
            if (targetId) {
                requiredScore++;
                const idAttr = node.getAttribute('id');
                if (idAttr && idAttr.getInitializer().getText().replace(/['"]/g, '') === targetId) {
                    score++;
                }
            }

            // 比對 Name
            if (targetName) {
                requiredScore++;
                const nameAttr = node.getAttribute('name');
                if (nameAttr && nameAttr.getInitializer().getText().replace(/['"]/g, '') === targetName) {
                    score++;
                }
            }

            // 比對 Class (模糊匹配，因為 React 是 className)
            if (targetClass) {
                requiredScore++;
                const classAttr = node.getAttribute('className') || node.getAttribute('class');
                if (classAttr) {
                    const actualClass = classAttr.getInitializer().getText().replace(/['"]/g, '');
                    // 只要包含主要類別即算匹配
                    if (actualClass.includes(targetClass.split(' ')[0])) {
                        score++;
                    }
                }
            }

            // 如果特徵吻合 (或者在沒有 ID/Name 的情況下標籤吻合)
            if (score === requiredScore || (requiredScore === 0 && tagName === targetTag)) {
                foundNode = node;
            }
        }
    }
});

// 4. 執行替換
if (foundNode) {
    // 如果是 JsxOpeningElement，則要替換整個 JsxElement (包含子元素)
    const nodeToReplace = foundNode.getKind() === SyntaxKind.JsxOpeningElement 
        ? foundNode.getParent() 
        : foundNode;

    nodeToReplace.replaceWithText(newCode);
    sourceFile.saveSync();
    console.log("SUCCESS");
} else {
    console.log("AST_MISMATCH");
    process.exit(0); // 交給後端降級機制處理
}
