module.exports = function(babel) {
  const { types: t } = babel;

  return {
    name: "cga-source-mapping-plugin",
    visitor: {
      JSXOpeningElement(path, state) {
        // 取得目前處理的檔案名稱
        const filename = state.file.opts.filename;
        
        // 排除掉不相干的目錄
        if (!filename || filename.includes('node_modules') || filename.includes('.next') || filename.includes('.shadow')) {
          return;
        }

        // 沙盒的根目錄
        const relativePath = filename.replace('/home/user/app', '');

        // 如果是 Fragment 或其他沒有 attributes 的，跳過
        if (!path.node.attributes) return;

        // 檢查是否已經有這個屬性，避免重複添加
        const hasAttr = path.node.attributes.some(
          attr => t.isJSXAttribute(attr) && (attr.name.name === 'data-cga-path' || attr.name.name === 'data-cga-trace')
        );

        if (!hasAttr) {
          // 注入精準路徑
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
