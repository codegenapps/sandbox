const ts = require('typescript');
const fs = require('fs');

/**
 * CGA 語法防火牆 (Syntax Guard) - 原生解析版
 * 用法: node syntax-checker.cjs <filePath>
 * 說明: 使用更輕量的 typescript.createSourceFile 解析器，徹底避免 ts-morph 的環境崩潰問題。
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
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 💡 針對 HTML 檔案，跳過 TS 語法檢查 (因為 HTML 不是合法的 TSX)
    if (filePath.toLowerCase().endsWith('.html')) {
        console.log('OK');
        process.exit(0);
    }
    
    // 🔬 改用原生 TypeScript 解析器，這是一個純粹的字符串到 AST 的轉換，不涉及 TypeCheck，絕對不會崩潰
    const sourceFile = ts.createSourceFile(
        filePath, 
        content, 
        ts.ScriptTarget.Latest, 
        true, 
        ts.ScriptKind.TSX
    );
    
    const diagnostics = sourceFile.parseDiagnostics;

    if (diagnostics && diagnostics.length > 0) {
        // 只過濾出真正的 Error (忽視 Warning)
        const fatalErrors = diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);
        
        if (fatalErrors.length > 0) {
            console.log('SYNTAX_ERROR: ' + fatalErrors[0].messageText);
            process.exit(0);
        }
    }

    console.log('OK');
} catch (e) {
    console.log('SYNTAX_ERROR: Native Parser Crash - ' + e.message);
}
