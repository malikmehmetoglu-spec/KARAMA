/* Minimal standalone runtime for .dc.html pages (x-dc template, sc-for, sc-if, {{holes}}, onX events). */
(function () {
  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(patch) { this.state = Object.assign({}, this.state, typeof patch === 'function' ? patch(this.state) : patch); this.__render && this.__render(); }
    forceUpdate() { this.__render && this.__render(); }
    renderVals() { return {}; }
  }
  window.DCLogic = DCLogic;

  const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const ONLY = /^\{\{\s*([^}]+?)\s*\}\}$/;
  function lookup(scope, path) {
    if (path === 'true') return true; if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
  }
  function interp(str, scope) { return str.replace(HOLE, (_, p) => { const v = lookup(scope, p); return v == null ? '' : String(v); }); }

  function build(node, scope, out) {
    if (node.nodeType === 3) { out.appendChild(document.createTextNode(interp(node.nodeValue, scope))); return; }
    if (node.nodeType !== 1) return;
    const tag = node.localName;
    if (tag === 'sc-for') {
      const m = (node.getAttribute('list') || '').match(ONLY);
      const list = (m ? lookup(scope, m[1]) : []) || [];
      const as = node.getAttribute('as') || 'item';
      list.forEach((item, i) => { const s = Object.create(scope); s[as] = item; s.$index = i; node.childNodes.forEach(c => build(c, s, out)); });
      return;
    }
    if (tag === 'sc-if') {
      const m = (node.getAttribute('value') || '').match(ONLY);
      if (m && lookup(scope, m[1])) node.childNodes.forEach(c => build(c, scope, out));
      return;
    }
    const el = node.namespaceURI && node.namespaceURI !== 'http://www.w3.org/1999/xhtml'
      ? document.createElementNS(node.namespaceURI, node.tagName) : document.createElement(tag);
    for (const a of Array.from(node.attributes)) {
      if (a.name.startsWith('hint-')) continue;
      const m = a.value.match(ONLY);
      if (a.name.startsWith('on') && m) { const fn = lookup(scope, m[1]); if (typeof fn === 'function') el.addEventListener(a.name.slice(2).toLowerCase(), fn); continue; }
      el.setAttribute(a.name, interp(a.value, scope));
    }
    node.childNodes.forEach(c => build(c, scope, el));
    out.appendChild(el);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('x-dc'); if (!root) return;
    const helmet = root.querySelector('helmet');
    if (helmet) { Array.from(helmet.childNodes).forEach(n => document.head.appendChild(n)); helmet.remove(); }
    const tpl = root.cloneNode(true);
    const host = document.createElement('div'); root.replaceWith(host);
    const script = document.querySelector('script[data-dc-script]');
    let Comp = DCLogic;
    if (script) Comp = new Function('DCLogic', script.textContent + '\n;return Component;')(DCLogic);
    const inst = new Comp({});
    inst.__render = () => { const frag = document.createDocumentFragment(); const v = inst.renderVals(); tpl.childNodes.forEach(c => build(c, v, frag)); host.replaceChildren(frag); };
    inst.__render();
    inst.componentDidMount && inst.componentDidMount();
  });
})();
