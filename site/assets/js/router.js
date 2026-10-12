// hash 路由：#/、#/menu、#/level/3、#/level/3/result、#/npc/A ……
// routes: [[pattern, handler]]，pattern 例如 '/level/:n/result'。

export function parse(hash) {
  const path = (hash || '').replace(/^#/, '') || '/';
  return path.startsWith('/') ? path : '/' + path;
}

export function match(pattern, path) {
  const ps = pattern.split('/').filter(Boolean);
  const xs = path.split('/').filter(Boolean);
  if (ps.length !== xs.length) return null;
  const params = {};
  for (let i = 0; i < ps.length; i++) {
    if (ps[i].startsWith(':')) params[ps[i].slice(1)] = decodeURIComponent(xs[i]);
    else if (ps[i] !== xs[i]) return null;
  }
  return params;
}

export function go(path, { replace = false } = {}) {
  const h = '#' + path;
  if (replace) history.replaceState(history.state, '', h);
  else location.hash = h;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function startRouter(routes, fallback) {
  function run() {
    const path = parse(location.hash);
    for (const [pattern, handler] of routes) {
      const params = match(pattern, path);
      if (params) return handler(params, path);
    }
    return fallback(path);
  }
  window.addEventListener('hashchange', run);
  run();
  return run;
}
