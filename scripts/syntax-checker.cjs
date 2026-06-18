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
    
    // 🔬 升級為微型編譯器（單一檔案型）：
    // 透過 skipLibCheck: true 與 types: [] 進行極速加載（不爬 node_modules，避免配置衝突），
    // 既能精準捕捉未宣告變數（ReferenceError），又能保持 100% 的啟動穩定性！
    const program = ts.createProgram([filePath], {
        noEmit: true,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.Latest,
        skipLibCheck: true,
        types: []
    });

    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
        console.log('SYNTAX_ERROR: Could not load source file inside program');
        process.exit(0);
    }

    // 1. 獲取語法診斷 (標籤閉合、成對括號等)
    const syntaxErrors = program.getSyntacticDiagnostics(sourceFile) || [];

    // 2. 獲取語意診斷，並透過過濾器排除「路徑別名或 module 找不到的假性解析錯誤」（如 2307, 2792, 2834, 7016）
    // 這樣可以 100% 捕獲重複宣告 (TS2300)、作用域/未宣告變數 (TS2304/2552)、巢狀 export 等致命編譯錯誤！
    const semanticDiagnostics = program.getSemanticDiagnostics(sourceFile) || [];
    const referenceErrors = semanticDiagnostics.filter(d => d.category === ts.DiagnosticCategory.Error && d.code !== 2307 && d.code !== 2792 && d.code !== 2834 && d.code !== 7016);

    const fatalErrors = [...syntaxErrors, ...referenceErrors];

    if (fatalErrors.length > 0) {
        const firstError = fatalErrors[0];
        let errorMsg = firstError.messageText;
        if (typeof errorMsg !== 'string') {
            errorMsg = errorMsg.messageText || 'Unknown typescript error';
        }
        
        // 輸出錯誤訊息，並附帶行號
        let lineInfo = "";
        if (firstError.file && firstError.start !== undefined) {
            const { line, character } = firstError.file.getLineAndCharacterOfPosition(firstError.start);
            lineInfo = ` (Line ${line + 1}:${character + 1})`;
        }

        console.log(`SYNTAX_ERROR: ${errorMsg}${lineInfo}`);
        process.exit(0);
    }

    console.log('OK');
} catch (e) {
    console.log('SYNTAX_ERROR: Native Parser Crash - ' + e.message);
}
