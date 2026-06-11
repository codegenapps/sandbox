const fs = require('fs');
const path = require('path');

const presetId = process.argv[2];
if (!presetId) {
  console.error("Usage: node apply_preset.cjs <preset_id>");
  process.exit(1);
}

try {
  // A. 100% 物理複製大師 md 到 .cga 核心設計契約中
  const srcPath = `/home/user/.cga/awesome-design-md/design-md/${presetId}/DESIGN.md`;
  const destPath = '/home/user/app/.cga/design-system/default/MASTER.md';
  
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Preset ${presetId} not found in awesome-design-md database.`);
  }
  
  const designContent = fs.readFileSync(srcPath, 'utf8');
  
  // 🚀 核心優化：1:1 對齊大師庫 Nested YAML 的色彩解碼正則（絕不抓空！）
  const primaryColor = designContent.match(/primary:\s*["']([^"']+)["']/)?.[1] || '#4A6B53';
  const surfaceColor = designContent.match(/canvas-soft:\s*["']([^"']+)["']/)?.[1] || 
                       designContent.match(/canvas:\s*["']([^"']+)["']/)?.[1] || '#FBF9F6';
  const accentColor = designContent.match(/ruby:\s*["']([^"']+)["']/)?.[1] || 
                      designContent.match(/magenta:\s*["']([^"']+)["']/)?.[1] || 
                      designContent.match(/link:\s*["']([^"']+)["']/)?.[1] || '#D4AF37';
                      
  // 圓角與字體提取
  const borderRadius = designContent.match(/borderRadius:\s*["']?([^"'\n]+)["']?/)?.[1] || '12px';
  const font = designContent.match(/fontFamily:\s*["']?([^"'\n]+)["']?/)?.[1] || 'var(--font-sans)';

  const updatedMasterContent = `---
vibe: ${presetId}
primary_color: ${primaryColor}
surface_color: ${surfaceColor}
accent_color: ${accentColor}
border_radius: ${borderRadius}
font_family: ${font}
---

${designContent}`;

  const cgaDir = '/home/user/app/.cga/design-system/default';
  if (!fs.existsSync(cgaDir)) fs.mkdirSync(cgaDir, { recursive: true });
  fs.writeFileSync(destPath, updatedMasterContent);

  // B. 毫秒級熱更新：回寫 /styles/globals.css 變數定義，iframe 瞬間變色！
  const cssPath = '/home/user/app/styles/globals.css';
  if (fs.existsSync(cssPath)) {
    let css = fs.readFileSync(cssPath, 'utf8');
    css = css.replace(/--color-primary:\s*[^;]+/g, `--color-primary: ${primaryColor}`);
    css = css.replace(/--color-surface:\s*[^;]+/g, `--color-surface: ${surfaceColor}`);
    css = css.replace(/--color-accent:\s*[^;]+/g, `--color-accent: ${accentColor}`);
    css = css.replace(/--color-text:\s*[^;]+/g, `--color-text: #2D3748`);
    fs.writeFileSync(cssPath, css);
  }
  
  console.log(`SUCCESS:${primaryColor},${surfaceColor},${accentColor}`);
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
