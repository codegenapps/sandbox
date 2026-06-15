const fs = require('fs');
const path = require('path');

const presetId = process.argv[2];
if (!presetId) {
  console.error("Usage: node apply_preset.cjs <preset_id>");
  process.exit(1);
}

// 💡 物理亮度計算
function getLuminance(hex) {
  try {
    const color = hex.replace('#', '').trim();
    if (color.length === 3) {
      const r = parseInt(color.substring(0, 1) + color.substring(0, 1), 16);
      const g = parseInt(color.substring(1, 2) + color.substring(1, 2), 16);
      const b = parseInt(color.substring(2, 3) + color.substring(2, 3), 16);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  } catch (e) {
    return 255;
  }
}

// 🚀 核心大師：全域 CSS 實體路徑自動探測器 (防止 Vite/Next/CRA 各框架路徑大打架！)
function detectGlobalCSSPath() {
  const root = '/home/user/app';
  
  // A. 經典框架全域樣式物理路徑候選池 (按優先順序探測)
  const candidates = [
    path.join(root, 'styles/globals.css'),     // Next.js Pages router (我們的盤古預設)
    path.join(root, 'src/index.css'),          // Vite / CRA TS 經典
    path.join(root, 'src/App.css'),            // Vite / CRA JS 經典
    path.join(root, 'src/app/globals.css'),    // Next.js App router (含 src)
    path.join(root, 'app/globals.css'),        // Next.js App router (扁平)
    path.join(root, 'styles.css'),             // 純靜態 / 扁平 HTML
    path.join(root, 'css/style.css'),          // 純靜態傳統
    path.join(root, 'src/styles.css')          // 自定義 Angular/React
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      console.log(`[CSS Detector] Target CSS located on disk: ${p}`);
      return p;
    }
  }

  // B. 智能自癒 Fallback：如果都沒找到，掃描專案中所有的 *.css 檔案，找出最像全域樣式的檔案
  try {
    const scanDir = (dir) => {
      let results = [];
      const list = fs.readdirSync(dir);
      list.forEach((file) => {
        const fullPath = path.join(dir, file);
        if (file === 'node_modules' || file === '.next' || file === '.git' || file === 'dist' || file === 'out') return;
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(scanDir(fullPath));
        } else if (file.endsWith('.css')) {
          results.push(fullPath);
        }
      });
      return results;
    };

    const cssFiles = scanDir(root);
    // 優先匹配名字含有 global、index、app、style 的 CSS 檔案
    const bestMatch = cssFiles.find(f => f.includes('global') || f.includes('index') || f.includes('app') || f.includes('style'));
    if (bestMatch) {
      console.log(`[CSS Detector] Fallback scanned best CSS match on disk: ${bestMatch}`);
      return bestMatch;
    }
    if (cssFiles.length > 0) {
      console.log(`[CSS Detector] Fallback to first css found: ${cssFiles[0]}`);
      return cssFiles[0];
    }
  } catch (e) {
    console.warn(`[CSS Detector Warning] Deep scan failed: ${e.message}`);
  }

  // C. 終極 Fallback：使用 Pages router 預設
  return path.join(root, 'styles/globals.css');
}

try {
  const srcPath = `/home/user/.cga/awesome-design-md/design-md/${presetId}/DESIGN.md`;
  const destPath = '/home/user/app/.cga/design-system/default/MASTER.md';
  
  if (!fs.existsSync(srcPath)) {
    throw new Error(`Preset ${presetId} not found in awesome-design-md database.`);
  }
  
  const designContent = fs.readFileSync(srcPath, 'utf8');
  const lowerContent = designContent.toLowerCase();
  
  // 🚀 A. 提取色彩變數
  const primaryColor = designContent.match(/primary:\s*["']([^"']+)["']/)?.[1] || '#4A6B53';
  const surfaceColor = designContent.match(/canvas-soft:\s*["']([^"']+)["']/)?.[1] || 
                       designContent.match(/canvas:\s*["']([^"']+)["']/)?.[1] || '#FBF9F6';
  const accentColor = designContent.match(/ruby:\s*["']([^"']+)["']/)?.[1] || 
                      designContent.match(/magenta:\s*["']([^"']+)["']/)?.[1] || 
                      designContent.match(/link:\s*["']([^"']+)["']/)?.[1] || '#D4AF37';
  
  // 🚀 A2. 提取文字對比色 ( 絕不發生白底白字慘案！)
  const onPrimaryColor = designContent.match(/on-primary:\s*["']([^"']+)["']/)?.[1] || '#ffffff';
  
  // 🚀 A3. 動態判定輔助色 (Accent) 文字對比色 ( 防止黃金背景配白字致盲！)
  const lumaAccent = getLuminance(accentColor);
  const onAccentColor = lumaAccent < 128 ? '#ffffff' : '#171717';

  // 🚀 B. 雙軌圓角提取基因 ( 智慧型分析，防止卡片變大圓球！)
  let borderRadius = '12px';       // 卡片、容器圓角
  let borderRadiusButton = '12px'; // 按鈕圓角
  
  if (presetId === 'vercel' || presetId === 'linear' || presetId === 'bmw' || 
      lowerContent.includes('border-radius: 0px') || 
      lowerContent.includes('sharp') || 
      lowerContent.includes('rectangular') || 
      lowerContent.includes('0px corner') || 
      lowerContent.includes('0px radius')) {
    borderRadius = '0px';
    borderRadiusButton = '0px';
  } else if (lowerContent.includes('pill') || lowerContent.includes('button-radius: 9999px')) {
    borderRadius = '12px';        // 卡片維持優雅的中圓角，維持結構平穩
    borderRadiusButton = '9999px'; // 僅按鈕解鎖為「發光膠囊」！
  } else if (lowerContent.includes('rounded-xl') || lowerContent.includes('border-radius: 12px')) {
    borderRadius = '12px';
    borderRadiusButton = '12px';
  } else if (lowerContent.includes('rounded-2xl') || lowerContent.includes('border-radius: 16px') || presetId === 'airbnb') {
    borderRadius = '16px';
    borderRadiusButton = '16px';
  }

  // 🚀 C. 提取字體氣質 ( 完美排除 sans-serif 對 serif 的子字串撞擊，並對應全域相容 Web-Safe 經典大師字體 )
  let fontFamily = "var(--font-sans)";
  if (lowerContent.includes('serif') && !lowerContent.includes('sans-serif')) {
    fontFamily = "Georgia, Cambria, 'Times New Roman', Times, serif"; // 優雅純襯線字體
  } else if (lowerContent.includes('mono') || lowerContent.includes('monospace') || lowerContent.includes('code') || presetId === 'vercel') {
    fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"; // 技術等寬字體
  } else if (lowerContent.includes('sohne') || lowerContent.includes('inter') || lowerContent.includes('sans-serif') || lowerContent.includes('sans') || presetId === 'stripe' || presetId === 'framer') {
    fontFamily = "Inter, 'SF Pro Display', -apple-system, sans-serif"; // 現代極簡字體
  }

  // 🚀 D. 提取光影與景深
  const luma = getLuminance(surfaceColor);
  let textColor = '#2D3748';
  let cardColor = 'rgba(255, 255, 255, 0.85)';
  let borderColor = 'rgba(0, 0, 0, 0.08)';
  let brandShadow = '0 10px 30px -3px rgba(0, 0, 0, 0.08)'; // 預設溫和投影

  if (luma < 128) {
    // 🌑 暗黑極客
    textColor = '#ffffff';
    cardColor = 'rgba(18, 18, 18, 0.85)';
    borderColor = 'rgba(255, 255, 255, 0.12)';
    brandShadow = '0 20px 40px -15px rgba(0,0,0,0.7)'; // 墨黑重投影
  } else {
    // ☀️ 亮色系
    if (lowerContent.includes('flat') || lowerContent.includes('no shadow') || presetId === 'vercel') {
      brandShadow = 'none'; // 扁平風，0 陰影！
    } else if (lowerContent.includes('glow') || lowerContent.includes('blue-shadow') || presetId === 'stripe') {
      brandShadow = '0 15px 35px -5px rgba(0, 55, 112, 0.12)'; // Stripe 發光藍陰影！
    }
  }

  // E. 寫入長期 Master 契約
  const updatedMasterContent = `---
vibe: ${presetId}
primary_color: ${primaryColor}
surface_color: ${surfaceColor}
accent_color: ${accentColor}
on_primary_color: ${onPrimaryColor}
on_accent_color: ${onAccentColor}
border_radius: ${borderRadius}
border_radius_button: ${borderRadiusButton}
font_family: ${fontFamily}
brand_shadow: ${brandShadow}
---

${designContent}`;

  const cgaDir = '/home/user/app/.cga/design-system/default';
  if (!fs.existsSync(cgaDir)) fs.mkdirSync(cgaDir, { recursive: true });
  fs.writeFileSync(destPath, updatedMasterContent);

  // F. 🚀 終極自適應路徑探測與寫入
  const cssPath = detectGlobalCSSPath();
  if (fs.existsSync(cssPath)) {
    let css = fs.readFileSync(cssPath, 'utf8');
    
    const rootVariables = `
:root {
  --background: #050505;
  --foreground: #ffffff;

  /* 🚀 [大師美學視覺變數] */
  --color-primary: ${primaryColor}; 
  --color-surface: ${surfaceColor}; 
  --color-accent: ${accentColor};  
  --color-text: ${textColor};    
  --color-card: ${cardColor};
  --color-border: ${borderColor};
  --color-on-primary: ${onPrimaryColor};
  --color-on-accent: ${onAccentColor};

  /* 🚀 [大師骨骼與光影變數] */
  --border-radius: ${borderRadius};
  --border-radius-button: ${borderRadiusButton};
  --brand-shadow: ${brandShadow};
  --font-family: ${fontFamily};

  /* 🚀 NextUI 核心變數大師級穿透直連 (動態主題一鍵套用) */
  --nextui-primary: var(--color-primary) !important;
  --nextui-primary-500: var(--color-primary) !important;
  --nextui-secondary: var(--color-accent) !important;
  --nextui-secondary-500: var(--color-accent) !important;
  --nextui-background: var(--color-surface) !important;
  --nextui-foreground: var(--color-text) !important;
}
`;
    // 動態正則覆蓋整個 :root {}，徹底消除 replace 匹配不到的致命隱患！
    css = css.replace(/:root\s*\{[^}]*\}/s, rootVariables.trim());
    fs.writeFileSync(cssPath, css);
  }
  
  console.log(`SUCCESS:${primaryColor},${surfaceColor},${accentColor}`);
} catch (e) {
  console.error('ERROR:', e.message);
  process.exit(1);
}
