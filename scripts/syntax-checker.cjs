const { Project, ScriptTarget, JsxEmit } = require('ts-morph');
const fs = require('fs');

/**
 * CGA 語法防火牆 (Syntax Guard)
 * 用法: node syntax-checker.cjs <filePath>
 * 說明: 專注於攔截 JSX 標籤未閉合、缺少括號等致命錯誤，忽略 TypeScript 型別警告。
 */

const filePath = process.argv[2];

if (!filePath) {
    console.error("Usage: node syntax-checker.cjs <filePath>");
    process.exit(1);
}

if (!fs.existsSync(filePath)) {
    console.error(`SYNTAX_ERROR: File not found at ${filePath}`);
    process.exit(0);
}

try {
    // 極致寬鬆模式：關閉所有依賴解析，專注於純粹的 AST 結構
    const project = new Project({
        compilerOptions: {
            target: ScriptTarget.ESNext,
            jsx: JsxEmit.Preserve,
            noResolve: true,
            skipLibCheck: true
        },
        skipAddingFilesFromTsConfig: true,
        skipFileDependencyResolution: true,
        useInMemoryFileSystem: false
    });

    const sourceFile = project.addSourceFileAtPath(filePath);
    const diags = sourceFile.getPreEmitDiagnostics();
    
    // 只攔截致命的語法結構破壞 (Category 1 = Error)
    const errors = diags.filter(d => {
        const cat = d.getCategory();
        const code = d.getCode();
        // 1005: expected token, 1109: expected expression, 17008: JSX unclosed
        return cat === 1 && (code === 1005 || code === 1109 || code === 17008);
    });

    if (errors.length > 0) {
        // 取第一個錯誤訊息即可
        console.log('SYNTAX_ERROR: ' + errors[0].getMessageText());
        process.exit(0); // 正常退出，讓 Go 解析 STDOUT
    }

    console.log('OK');
} catch (e) {
    // 捕捉 ts-morph 本身的崩潰
    console.log('SYNTAX_ERROR: Parser Crash - ' + e.message);
}
