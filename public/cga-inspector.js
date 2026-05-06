if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    document.body.addEventListener('click', (e) => {
      if (e.altKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const target = e.target;
        const tag = target.tagName.toLowerCase();
        let className = target.className;
        if (typeof className !== 'string') className = '';
        const text = target.innerText ? target.innerText.substring(0, 30) : '';
        let info = '<' + tag;
        if (className) info += ' class="' + className + '"';
        info += '>';
        if (text) info += text + '</' + tag + '>';
        window.parent.postMessage({ type: 'CGA_ELEMENT_SELECTED', path: window.location.pathname, element: info }, '*');
        target.style.outline = '3px solid #3b82f6';
        target.style.outlineOffset = '2px';
        setTimeout(() => { target.style.outline = ''; target.style.outlineOffset = ''; }, 1000);
      }
    }, true);
  });
}