const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

// 💡 零依賴實作：使用內建 crypto 產生 nanoid
function nanoid(t=21){return crypto.randomBytes(t).toString("base64").replace(/[+/]/g,"_").substring(0,t)}

function escapeQuotes(str) { return str ? str.replace(/[']/g, "''") : ""; }

function parseDefault(field) {
  if (field.default === null || field.default === undefined) return "";
  const val = String(field.default).trim();
  if (val === "" || val === "NULL" || val === "[object Object]") return "";
  const upperVal = val.toUpperCase();
  const noQuoteTypes = ['INTEGER', 'NUMERIC', 'BOOLEAN', 'SERIAL', 'BIGSERIAL', 'INT', 'DECIMAL'];
  const specialValues = ['CURRENT_TIMESTAMP', 'NULL', 'TRUE', 'FALSE', 'NOW()', 'CURRENT_DATE'];
  if (specialValues.some(v => upperVal.startsWith(v)) || noQuoteTypes.includes(field.type.toUpperCase()) || !isNaN(val)) {
    return upperVal === 'NOW()' ? 'CURRENT_TIMESTAMP' : val;
  }
  return "'" + escapeQuotes(val) + "'";
}

function parseCommentForFields(comment) {
    if (typeof comment !== 'string') return { type: '' };
    const typeMatch = comment.match(/@type=([^@\s]+)/);
    return { type: typeMatch ? typeMatch[1] : '' };
}

function fromPostgres(sql, currentTables) {
    const tables = [];
    const relationships = [];
    const tableComments = {};
    const comments = {};
    const commentRegex = /COMMENT ON (TABLE|COLUMN) "?([\w\.]+)"? IS '(.*?)';/gi;
    let match;
    while ((match = commentRegex.exec(sql)) !== null) {
        const type = match[1].toUpperCase();
        const target = match[2].replace(/"/g, '');
        if (type === 'TABLE') tableComments[target] = match[3];
        else comments[target] = match[3];
    }

    const tableRegex = /CREATE TABLE "?(\w+)"? \(([\s\S]*?)\);/gi;
    let tableMatch;
    while ((tableMatch = tableRegex.exec(sql)) !== null) {
        const tableName = tableMatch[1];
        const body = tableMatch[2];
        const tableId = nanoid();
        const table = { id: tableId, name: tableName, fields: [], indices: [], uniqueConstraints: [], comment: tableComments[tableName] || "", color: "#175e7a" };
        const lines = body.split(',\n').map(l => l.trim()).filter(l => l);
        lines.forEach(line => {
            const upperLine = line.toUpperCase();
            if (upperLine.startsWith('PRIMARY KEY') || upperLine.startsWith('CONSTRAINT') || upperLine.startsWith('FOREIGN KEY')) return;
            if (upperLine.startsWith('UNIQUE')) {
                const uMatch = line.match(/UNIQUE\s*\((.*?)\)/i);
                if (uMatch) table.uniqueConstraints.push(uMatch[1].split(',').map(c => c.trim().replace(/"/g, '')));
                return;
            }
            const partsMatch = line.match(/^"?(\w+)"?\s+([\w]+(?:\([\d, ]+\))?)(.*)$/i);
            if (!partsMatch) return;
            const colName = partsMatch[1];
            let typeFull = partsMatch[2].toUpperCase();
            typeFull = typeFull.replace(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/, '($1,$2)');
            let type = typeFull, size = "";
            if (typeFull.includes('(')) {
                const s = typeFull.match(/(\w+)\((.*?)\)/);
                if (s) { type = s[1]; size = s[2].replace(/\s/g, ''); }
            }
            const rest = partsMatch[3];
            const isPrimary = rest.toUpperCase().includes('PRIMARY KEY');
            const field = { id: nanoid(), name: colName, type: type, size: size, primary: isPrimary, notNull: rest.toUpperCase().includes('NOT NULL') || isPrimary, unique: rest.toUpperCase().includes('UNIQUE'), increment: rest.toUpperCase().includes('GENERATED') || type.includes('SERIAL'), default: (rest.match(/DEFAULT\s+((?!AS|GENERATED|IDENTITY)[^(\s,;)]+|\(.*?\))/i) || [])[1]?.replace(/'/g, '').replace(/\(\)/g, '') || "", comment: comments[tableName + "." + colName] || comments[colName] || "" };
            if (colName === 'id') { field.type = 'INTEGER'; field.primary = true; field.increment = true; }
            table.fields.push(field);
        });
        tables.push(table);
    }
    
    // Add ALTER TABLE parsing
    const alterRegex = /ALTER TABLE\s+"?(\w+)"?\s+ADD(?:\s+COLUMN)?\s+"?(\w+)"?\s+([\w]+(?:\([\d, ]+\))?)([\s\S]*?);/gi;
    let alterMatch;
    while ((alterMatch = alterRegex.exec(sql)) !== null) {
        const tableName = alterMatch[1];
        const colName = alterMatch[2];
        let typeFull = alterMatch[3].toUpperCase();
        typeFull = typeFull.replace(/\(\s*(\d+)\s*,\s*(\d+)\s*\)/, '($1,$2)');
        let type = typeFull, size = "";
        if (typeFull.includes('(')) {
            const s = typeFull.match(/(\w+)\((.*?)\)/);
            if (s) { type = s[1]; size = s[2].replace(/\s/g, ''); }
        }
        const rest = alterMatch[4] || "";
        const isPrimary = rest.toUpperCase().includes('PRIMARY KEY');
        const field = { 
            id: nanoid(), 
            name: colName, 
            type: type, 
            size: size, 
            primary: isPrimary, 
            notNull: rest.toUpperCase().includes('NOT NULL') || isPrimary, 
            unique: rest.toUpperCase().includes('UNIQUE'), 
            increment: rest.toUpperCase().includes('GENERATED') || type.includes('SERIAL'), 
            default: (rest.match(/DEFAULT\s+((?!AS|GENERATED|IDENTITY)[^(\s,;)]+|\(.*?\))/i) || [])[1]?.replace(/'/g, '').replace(/\(\)/g, '') || "", 
            comment: comments[tableName + "." + colName] || comments[colName] || "" 
        };
        
        let targetTable = tables.find(t => t.name === tableName);
        if (!targetTable && currentTables) {
            const extTable = currentTables.find(t => t.name === tableName);
            if (extTable) {
                targetTable = JSON.parse(JSON.stringify(extTable));
                tables.push(targetTable);
            }
        }
        if (targetTable) {
            const existingFieldIdx = targetTable.fields.findIndex(f => f.name === colName);
            if (existingFieldIdx !== -1) {
                targetTable.fields[existingFieldIdx] = { ...targetTable.fields[existingFieldIdx], ...field };
            } else {
                targetTable.fields.push(field);
            }
        }
    }

    return { tables, relationships };
}

function generateExportSQL(diagram) {
    const tableSql = diagram.tables.map(table => {
        const fieldDefinitions = (table.fields || []).map(f => {
            const dVal = f.increment ? "" : parseDefault(f);
            const sizeStr = f.size ? `(${f.size})` : "";
            return `	"${f.name}" ${f.type}${sizeStr} ${f.notNull ? 'NOT NULL' : ''} ${f.unique ? 'UNIQUE' : ''} ${f.increment ? 'GENERATED BY DEFAULT AS IDENTITY' : ''} ${dVal !== "" ? 'DEFAULT '+dVal : ''}`.replace(/\s+/g, ' ').trim();
        }).join(",\n");
        const pk = table.fields.some(f => f.primary) ? `,\n	PRIMARY KEY(${table.fields.filter(f => f.primary).map(f => `"${f.name}"`).join(", ")})` : "";
        const uq = (table.uniqueConstraints || []).map(c => `,\n	UNIQUE (${c.map(f => `"${f}"`).join(", ")})`).join("");
        const comments = [table.comment ? `\nCOMMENT ON TABLE "${table.name}" IS '${escapeQuotes(table.comment)}';` : ""];
        table.fields.forEach(f => { if(f.comment) comments.push(`\nCOMMENT ON COLUMN "${table.name}"."${f.name}" IS '${escapeQuotes(f.comment)}';`); });
        const indices = (table.indices || []).map(i => `\nCREATE ${i.unique ? "UNIQUE " : ""}INDEX "${i.name.replace(/\s+/g, '_')}" ON "${table.name}" (${i.fields.map(f => `"${f}"`).join(", ")});`).join("");
        return `CREATE TABLE "${table.name}" (\n${fieldDefinitions}${pk}${uq}\n);` + comments.join("") + indices;
    }).join("\n\n");
    const fks = (diagram.relationships || []).map(r => {
        const sT = diagram.tables.find(t => t.id === r.startTableId), eT = diagram.tables.find(t => t.id === r.endTableId);
        if (!sT || !eT) return "";
        const sF = sT.fields.find(f => f.id === r.startFieldId), eF = eT.fields.find(f => f.id === r.endFieldId);
        if (!sF || !eF) return "";
        return `ALTER TABLE "${sT.name}" ADD FOREIGN KEY ("${sF.name}") REFERENCES "${eT.name}" ("${eF.name}") ON UPDATE ${r.updateConstraint.toUpperCase()} ON DELETE ${r.deleteConstraint.toUpperCase()};`;
    }).filter(Boolean).join("\n");
    return ["CREATE SCHEMA IF NOT EXISTS public;\nSET search_path TO public;", tableSql, fks].filter(Boolean).join("\n\n");
}

function generateMigrationHints(currentDiagram, resultTables) {
    const hints = [];
    const currentTableMap = new Map();
    (currentDiagram.tables || []).forEach(t => currentTableMap.set(t.name, t));
    resultTables.forEach(newT => {
        if (!currentTableMap.has(newT.name)) {
            hints.push(`-- HINT: New table "${newT.name}" created. Please find its full definition in the Full DDL script.`);
        } else {
            const oldT = currentTableMap.get(newT.name);
            const oldFields = new Set((oldT.fields || []).map(f => f.name));
            (newT.fields || []).forEach(newF => {
                if (!oldFields.has(newF.name)) hints.push(`-- HINT: New column "${newF.name}" added to table "${newT.name}". Please find its definition in the Full DDL script.`);
            });
        }
    });
    return hints.length ? hints.join('\n\n') : "-- No changes detected.";
}

function toPostgres(diagram, migrationHints) {
    const triggers = [];
    diagram.tables.forEach(table => {
        (table.fields || []).forEach(f => {
            const pc = parseCommentForFields(f.comment);
            if (pc.type === 'auto_updatedtime' || (f.comment && f.comment.includes('auto_updatedtime'))) {
                const fn = `f_auto_update_${table.name}_${f.name}`;
                triggers.push(`\nCREATE OR REPLACE FUNCTION "${fn}"() RETURNS trigger AS $$\nBEGIN\n  NEW."${f.name}" = NOW();\n  RETURN NEW;\nEND;\n$$ LANGUAGE plpgsql;\nCREATE TRIGGER "trg_auto_update_${table.name}_${f.name}" BEFORE UPDATE ON "${table.name}" FOR EACH ROW EXECUTE FUNCTION "${fn}"();`);
            }
        });
    });
    const triggerBlock = triggers.length ? "\n\n-- AUTO_UPDATE_TIMESTAMP_TRIGGERS\n" + triggers.join("\n") + "\n-- END_AUTO_UPDATE_TIMESTAMP_TRIGGERS" : "";
    return migrationHints + "\n\n-- ------分隔線------\n\n" + generateExportSQL(diagram) + triggerBlock;
}

// 💡 零依賴實作：使用內建 https 模組獲取畫布
function fetchDiagram(apiUrl, projectId, token) {
    return new Promise((resolve, reject) => {
        const url = `${apiUrl}/projects/${projectId}/diagram`;
        https.get(url, { headers: { 'Authorization': `Bearer ${token}` } }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) reject(new Error('HTTP ' + res.statusCode));
                else try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function run() {
    const [projectId, apiUrl, token, sqlPath] = process.argv.slice(2);
    try {
        let currentDiagram = { tables: [], relationships: [] };
        
        // 🚀 關鍵重構：優先讀取本地產物，支持流水線作業
        const localPath = '/home/user/app/.cga/merged_diagram.json';
        if (fs.existsSync(localPath)) {
            try {
                const localData = fs.readFileSync(localPath, 'utf8');
                if (localData) currentDiagram = JSON.parse(localData);
            } catch (e) {
                // 若解析失敗則 fallback 到雲端
            }
        }

        // 若本地無產物，才向雲端獲取
        if (currentDiagram.tables.length === 0) {
            const res = await fetchDiagram(apiUrl, projectId, token);
            if (res.data?.diagram) currentDiagram = JSON.parse(res.data.diagram);
        }
        
        const newSql = fs.readFileSync(sqlPath, 'utf8');
        const result = fromPostgres(newSql, currentDiagram.tables);
        const migrationHints = generateMigrationHints(currentDiagram, result.tables);

        const tableMap = new Map();
        let maxX = 100;
        let maxY = 100;
        
        // 尋找現有畫布的最佳排列位置，同時支援 position 物件與根部 x,y 欄位
        (currentDiagram.tables || []).forEach(t => {
            tableMap.set(t.name, t);
            const curX = t.x || (t.position && t.position.x) || 0;
            const curY = t.y || (t.position && t.position.y) || 0;
            if (curX > maxX) maxX = curX;
            if (curY > maxY) maxY = curY;
        });

        const newTablesToArrange = [];
        result.tables.forEach(t => {
           if (tableMap.has(t.name)) {
               const existing = tableMap.get(t.name);
               
               // 💡 智慧合併策略：避免 ALTER TABLE 覆寫掉現有的完整設定
               const mergedComment = t.comment ? t.comment : existing.comment;
               const mergedIndices = (t.indices && t.indices.length > 0) ? t.indices : existing.indices;
               
               // 對於欄位，如果 targetTable 是從 currentTables 拷貝來的，t.fields 已經包含了所有舊欄位+新欄位
               // 但為保險起見，我們還是把 t.fields 直接覆寫過去，因為前面的邏輯已經做了 merge
               tableMap.set(t.name, { ...existing, fields: t.fields, comment: mergedComment, indices: mergedIndices });
           } else {
               // 💡 終極相容修正：同時寫入根部 x,y 與 position 物件
               maxX += 150;
               maxY += 100;
               t.x = maxX;
               t.y = maxY;
               t.position = { x: maxX, y: maxY };
               
               tableMap.set(t.name, t);
               newTablesToArrange.push(t);
           }
        });

        const finalTables = Array.from(tableMap.values());
        const validTableIds = new Set(finalTables.map(t => t.id));

        const mergedDiagram = { ...currentDiagram, tables: finalTables };
        process.stdout.write(JSON.stringify({ status: 'success', mergedDiagram: mergedDiagram, migrationSql: toPostgres(mergedDiagram, migrationHints) }));
    } catch (err) { process.stderr.write("MERGE_FAILED: " + err.message); process.exit(1); }
}
run();
