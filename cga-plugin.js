module.exports = function(babel) {
  const { types: t } = babel;

  return {
    name: "cga-source-mapping-plugin",
    visitor: {
      JSXOpeningElement(path, state) {
        // 取得目前處理的檔案名稱
        const filename = state.file.opts.filename;
        
        // 排除掉不相干的目錄，只處理專案內的代碼
        if (!filename || filename.includes('node_modules') || filename.includes('.next')) {
          return;
        }

        // 將絕對路徑轉換為相對於專案根目錄的路徑
        // 沙盒的根目錄是 /home/user/app
        const relativePath = filename.replace('/home/user/app', '');

        // 檢查是否已經有這個屬性，避免重複添加
        const hasAttr = path.node.attributes.some(
          attr => t.isJSXAttribute(attr) && attr.name.name === 'data-cga-path'
        );

        if (!hasAttr) {
          // 動態加上 data-cga-path="/src/components/MyComponent.tsx"
          path.node.attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier('data-cga-path'),
              t.stringLiteral(relativePath)
            )
          );
        }
      }
    }
  };
};
