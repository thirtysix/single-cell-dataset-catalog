/* Shared helpers: data loading, DOM, formatting, filterable table, combobox, Plotly wrappers. */
const Data = (() => {
  const cache = new Map();
  async function json(path) {
    if (!cache.has(path)) {
      cache.set(path, fetch(path, { cache: 'no-cache' }).then(r => {
        if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
        return r.json();
      }));
    }
    return cache.get(path);
  }
  let recs = null;
  async function records() {
    if (recs) return recs;
    const [meta, raw] = await Promise.all([json('data/meta.json'), json('data/records.json')]);
    const V = meta.vocab, C = raw.cols, ix = Object.fromEntries(C.map((c, i) => [c, i]));
    const dec = (field, arr) => (arr || []).map(i => V[field][i]);
    recs = raw.rows.map((r, i) => ({
      i, record_id: r[ix.record_id], study_id: r[ix.study_id], source: V.source[r[ix.source]], title: r[ix.title],
      study_title: r[ix.study_title] || '', year: r[ix.year], organs: dec('organs', r[ix.organs]), resp_class: V.resp_class[r[ix.resp_class]],
      regions: dec('regions', r[ix.resp_regions]), tissues: r[ix.tissues] || [],
      tissue_terms: ix.tissue_terms != null ? dec('tissue_terms', r[ix.tissue_terms]) : [],
      disease_groups: dec('disease_groups', r[ix.disease_groups]), diseases: r[ix.diseases] || [],
      dev: dec('dev', r[ix.dev_groups]), sample_types: dec('sample_types', r[ix.sample_types]),
      modalities: dec('modalities', r[ix.modalities]), suspension: dec('suspension', r[ix.suspension]),
      assays: r[ix.assays] || [], n_cells: r[ix.n_cells], n_donors: r[ix.n_donors], n_samples: r[ix.n_samples],
      access: V.access[r[ix.access]], is_sc_rna: r[ix.is_sc_rna], counts: r[ix.counts], tier: r[ix.tier],
      download_gb: r[ix.download_gb], local: r[ix.local], doi: r[ix.doi], share: ix.share != null ? r[ix.share] : null,
      n_reported: ix.n_reported != null ? r[ix.n_reported] : null,
    }));
    recs.byId = new Map(recs.map(r => [r.record_id, r]));
    return recs;
  }
  async function detail(recordId) {
    const shard = await json(`data/detail/${String(shardOf(recordId)).padStart(3, '0')}.json`);
    return shard[recordId];
  }
  function shardOf(s) { return parseInt(md5(s).slice(-8), 16) % 256; }  // python: int(md5,16) % 256
  return { json, records, detail };
})();

/* Minimal MD5 (RFC 1321) - needed only to locate the detail shard that python wrote. */
function md5(str) {
  function rh(n) { let s = '', j; for (j = 0; j <= 3; j++) s += ((n >> (j * 8 + 4)) & 0x0F).toString(16) + ((n >> (j * 8)) & 0x0F).toString(16); return s; }
  function ad(x, y) { const l = (x & 0xFFFF) + (y & 0xFFFF); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xFFFF); }
  function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
  function cm(q, a, b, x, s, t) { return ad(rl(ad(ad(a, q), ad(x, t)), s), b); }
  function ff(a, b, c, d, x, s, t) { return cm((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cm((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cm(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cm(c ^ (b | (~d)), a, b, x, s, t); }
  const bytes = new TextEncoder().encode(str), n = bytes.length, nb = ((n + 8) >> 6) + 1, x = new Array(nb * 16).fill(0);
  for (let i = 0; i < n; i++) x[i >> 2] |= bytes[i] << ((i % 4) * 8);
  x[n >> 2] |= 0x80 << ((n % 4) * 8); x[nb * 16 - 2] = n * 8;
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (let i = 0; i < x.length; i += 16) {
    const A = a, B = b, C = c, D = d;
    a = ff(a, b, c, d, x[i], 7, -680876936); d = ff(d, a, b, c, x[i + 1], 12, -389564586); c = ff(c, d, a, b, x[i + 2], 17, 606105819); b = ff(b, c, d, a, x[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, x[i + 4], 7, -176418897); d = ff(d, a, b, c, x[i + 5], 12, 1200080426); c = ff(c, d, a, b, x[i + 6], 17, -1473231341); b = ff(b, c, d, a, x[i + 7], 22, -45705983);
    a = ff(a, b, c, d, x[i + 8], 7, 1770035416); d = ff(d, a, b, c, x[i + 9], 12, -1958414417); c = ff(c, d, a, b, x[i + 10], 17, -42063); b = ff(b, c, d, a, x[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, x[i + 12], 7, 1804603682); d = ff(d, a, b, c, x[i + 13], 12, -40341101); c = ff(c, d, a, b, x[i + 14], 17, -1502002290); b = ff(b, c, d, a, x[i + 15], 22, 1236535329);
    a = gg(a, b, c, d, x[i + 1], 5, -165796510); d = gg(d, a, b, c, x[i + 6], 9, -1069501632); c = gg(c, d, a, b, x[i + 11], 14, 643717713); b = gg(b, c, d, a, x[i], 20, -373897302);
    a = gg(a, b, c, d, x[i + 5], 5, -701558691); d = gg(d, a, b, c, x[i + 10], 9, 38016083); c = gg(c, d, a, b, x[i + 15], 14, -660478335); b = gg(b, c, d, a, x[i + 4], 20, -405537848);
    a = gg(a, b, c, d, x[i + 9], 5, 568446438); d = gg(d, a, b, c, x[i + 14], 9, -1019803690); c = gg(c, d, a, b, x[i + 3], 14, -187363961); b = gg(b, c, d, a, x[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, x[i + 13], 5, -1444681467); d = gg(d, a, b, c, x[i + 2], 9, -51403784); c = gg(c, d, a, b, x[i + 7], 14, 1735328473); b = gg(b, c, d, a, x[i + 12], 20, -1926607734);
    a = hh(a, b, c, d, x[i + 5], 4, -378558); d = hh(d, a, b, c, x[i + 8], 11, -2022574463); c = hh(c, d, a, b, x[i + 11], 16, 1839030562); b = hh(b, c, d, a, x[i + 14], 23, -35309556);
    a = hh(a, b, c, d, x[i + 1], 4, -1530992060); d = hh(d, a, b, c, x[i + 4], 11, 1272893353); c = hh(c, d, a, b, x[i + 7], 16, -155497632); b = hh(b, c, d, a, x[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, x[i + 13], 4, 681279174); d = hh(d, a, b, c, x[i], 11, -358537222); c = hh(c, d, a, b, x[i + 3], 16, -722521979); b = hh(b, c, d, a, x[i + 6], 23, 76029189);
    a = hh(a, b, c, d, x[i + 9], 4, -640364487); d = hh(d, a, b, c, x[i + 12], 11, -421815835); c = hh(c, d, a, b, x[i + 15], 16, 530742520); b = hh(b, c, d, a, x[i + 2], 23, -995338651);
    a = ii(a, b, c, d, x[i], 6, -198630844); d = ii(d, a, b, c, x[i + 7], 10, 1126891415); c = ii(c, d, a, b, x[i + 14], 15, -1416354905); b = ii(b, c, d, a, x[i + 5], 21, -57434055);
    a = ii(a, b, c, d, x[i + 12], 6, 1700485571); d = ii(d, a, b, c, x[i + 3], 10, -1894986606); c = ii(c, d, a, b, x[i + 10], 15, -1051523); b = ii(b, c, d, a, x[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, x[i + 8], 6, 1873313359); d = ii(d, a, b, c, x[i + 15], 10, -30611744); c = ii(c, d, a, b, x[i + 6], 15, -1560198380); b = ii(b, c, d, a, x[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, x[i + 4], 6, -145523070); d = ii(d, a, b, c, x[i + 11], 10, -1120210379); c = ii(c, d, a, b, x[i + 2], 15, 718787259); b = ii(b, c, d, a, x[i + 9], 21, -343485551);
    a = ad(a, A); b = ad(b, B); c = ad(c, C); d = ad(d, D);
  }
  return rh(a) + rh(b) + rh(c) + rh(d);
}

/* ---- DOM + formatting ------------------------------------------------------------------- */
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
  return e;
}
const fmt = {
  n(v) { if (v == null || v === '') return ''; return Number(v).toLocaleString('en-US'); },
  c(v) {
    if (v == null || v === '' || isNaN(v)) return '';
    const a = Math.abs(v);
    if (a >= 1e9) return (v / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
    if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return String(Math.round(v));
  },
  gb(v) { return v == null || isNaN(v) ? '' : v < 0.1 ? '<0.1' : v.toFixed(v < 10 ? 2 : 1); },
  list(v, k = 3) { if (!Array.isArray(v)) return v ?? ''; return v.length > k ? `${v.slice(0, k).join(', ')} +${v.length - k}` : v.join(', '); },
  pct(v) { return v == null ? '' : (100 * v).toFixed(v < 0.1 ? 1 : 0) + '%'; },
};
/* A list cell: first k values, "+N" expands in place. pcts (parallel, -1 = not counted) adds a cell share. */
function listCell(v, pcts, open, onToggle, k = 3) {
  const shown = open ? v : v.slice(0, k);
  const kids = shown.flatMap((x, i) => {
    const p = pcts ? pcts[i] : null;
    const item = [document.createTextNode(String(x))];
    if (p != null && p >= 0) item.push(el('span', { class: 'share', text: ` ${p < 1 ? '<1' : p}%` }));
    return i ? [document.createTextNode(', '), ...item] : item;
  });
  if (v.length > k) kids.push(' ', el('button', { type: 'button', class: 'more', 'aria-expanded': open ? 'true' : 'false',
    text: open ? 'less' : `+${v.length - k}`, onclick: e => { e.stopPropagation(); onToggle(); } }));
  return el('span', { class: 'lc' }, kids);
}
function chip(text, cls = '') { return el('span', { class: `chip ${cls}`, text }); }
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function toTSV(cols, rows) {
  const esc = v => String(v ?? '').replace(/[\t\n\r]+/g, ' ');
  return [cols.join('\t'), ...rows.map(r => r.map(esc).join('\t'))].join('\n');
}
function download(name, text) {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/tab-separated-values' })), download: name });
  document.body.append(a); a.click(); a.remove();
}

/* ---- Filterable, sortable table ----------------------------------------------------------
   columns: {key, label, get(row), type:'text'|'num'|'list', render(row) -> node|string,
             filter: 'auto'|'contains'|'set'|'tiers'|false, firstDir, width}
   Filter state is one object set synchronously; only rendering is debounced. */
function makeTable(host, { columns, rows = [], sort, maxRows = 500, onRow, name = 'table', initialFilters = {},
                             rowKey = r => r.record_id ?? r.i }) {
  const state = { rows, sort: sort || { key: columns[0].key, dir: 'asc' }, filters: { ...initialFilters } };
  const known = {};               // column -> Set of its lower-cased values: a typed exact value filters exactly
  const expanded = new Set();     // `${rowKey}|${col}` of list cells the user opened; survives sort and filter
  const meta = el('div', { class: 'tmeta' });
  const wrap = el('div', { class: 'tablewrap' });
  const table = el('table', { class: 't' });
  const thead = el('thead'), tbody = el('tbody');
  table.append(thead, tbody); wrap.append(table); host.replaceChildren(meta, wrap);
  let timer = null;
  const later = () => { clearTimeout(timer); timer = setTimeout(render, 120); };
  const val = (c, r) => (c.get ? c.get(r) : r[c.key]);

  function kindOf(c) {
    if (c.filter === false) return null;
    if (c.filter && c.filter !== 'auto') return c.filter;
    if (c.type === 'num') return 'tiers';
    const vals = new Set();
    for (const r of state.rows) {
      const v = val(c, r);
      (Array.isArray(v) ? v : [v]).forEach(x => { if (x != null && x !== '') vals.add(x); });
      if (vals.size > 60) return 'contains';
    }
    return 'set';
  }
  const TIERS = [['', 'any'], ['k1', '≥ 1K'], ['k10', '≥ 10K'], ['k100', '≥ 100K'], ['m1', '≥ 1M'], ['none', 'unknown']];
  const tierTest = { k1: v => v >= 1e3, k10: v => v >= 1e4, k100: v => v >= 1e5, m1: v => v >= 1e6, none: v => v == null };

  function buildHead() {
    const tr = el('tr'), fr = el('tr', { class: 'filters' });
    for (const c of columns) {
      const th = el('th', { 'data-col': c.key, class: c.group ? 'gstart' : null, style: c.width ? `width:${c.width}` : null }, c.label,
        el('span', { class: 'dir', text: state.sort.key === c.key ? (state.sort.dir === 'asc' ? '▲' : '▼') : '' }));
      th.addEventListener('click', () => {
        if (state.sort.key === c.key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
        else state.sort = { key: c.key, dir: c.firstDir || (c.type === 'num' ? 'desc' : 'asc') };
        buildHead(); render();
      });
      tr.append(th);
      const td = el('td', { class: c.group ? 'gstart' : null }); const k = kindOf(c); const cur = state.filters[c.key] ?? '';
      let ctl = null;
      if (k === 'contains' || k === 'set') {
        // searchable with suggestions: a value picked from the list (or typed exactly) matches exactly,
        // anything else matches as "contains"
        const counts = new Map();
        for (const r of state.rows) { const v = val(c, r); (Array.isArray(v) ? v : [v]).forEach(x => {
          if (x != null && x !== '') counts.set(String(x), (counts.get(String(x)) || 0) + 1); }); }
        known[c.key] = new Set([...counts.keys()].map(x => x.toLowerCase()));
        const yn = v => v === 'true' ? 'yes' : v === 'false' ? 'no' : v;
        const opts = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([v, n]) => [yn(v), n, v]);
        const box = filterCombo({ options: opts, value: yn(cur), label: c.label,
          placeholder: k === 'set' ? 'any' : 'contains…',
          onChange: (shown, raw) => {
            const v = raw ?? opts.find(o => o[0].toLowerCase() === shown.trim().toLowerCase())?.[2] ?? shown.trim();
            state.filters[c.key] = v; box.input.classList.toggle('on', !!v); raw != null ? render() : later();
          } });
        ctl = box.input;
        td.append(box.el);
      } else if (k === 'tiers') {
        ctl = el('select', {}, TIERS.map(([v, l]) => el('option', { value: v, text: l })));
        ctl.value = cur;
        ctl.addEventListener('change', () => { state.filters[c.key] = ctl.value; ctl.classList.toggle('on', !!ctl.value); render(); });
      }
      if (ctl) {
        ctl.classList.toggle('on', !!cur);
        ['click', 'mousedown', 'keydown'].forEach(ev => ctl.addEventListener(ev, e => e.stopPropagation()));
        if (!ctl.isConnected) td.append(ctl);
      }
      fr.append(td);
    }
    thead.replaceChildren(tr, fr);
  }

  function filtered() {
    const active = columns.map(c => [c, state.filters[c.key]]).filter(([, f]) => f !== '' && f != null);
    let out = state.rows.filter(r => active.every(([c, f]) => {
      const v = val(c, r); const k = kindOf(c);
      if (k === 'tiers') return tierTest[f](v);
      const fl = String(f).toLowerCase();
      if (known[c.key]?.has(fl)) {      // a known value: exact match (case-insensitive)
        return Array.isArray(v) ? v.some(x => String(x).toLowerCase() === fl) : String(v ?? '').toLowerCase() === fl;
      }
      const s = (Array.isArray(v) ? v.join(' ') : String(v ?? '')).toLowerCase();
      return fl.split(/[\s,]+/).filter(Boolean).some(t => s.includes(t));
    }));
    const c = columns.find(x => x.key === state.sort.key) || columns[0];
    const s = state.sort.dir === 'asc' ? 1 : -1;
    out.sort((a, b) => {
      let va = val(c, a), vb = val(c, b);
      if (Array.isArray(va)) va = va.join(', '); if (Array.isArray(vb)) vb = vb.join(', ');
      if (va == null || va === '') return 1; if (vb == null || vb === '') return -1;
      return (typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))) * s;
    });
    return out;
  }

  function render() {
    const out = filtered();
    const frag = document.createDocumentFragment();
    for (const r of out.slice(0, maxRows)) {
      const tr = el('tr', onRow ? { style: 'cursor:pointer' } : {});
      if (onRow) tr.addEventListener('click', e => { if (e.target.closest('a')) return; onRow(r); });
      for (const c of columns) {
        const v = c.render ? c.render(r) : val(c, r);
        const td = el('td', { class: [c.type === 'num' ? 'num' : c.clamp ? 'clamp' : '', c.group ? 'gstart' : ''].join(' ').trim() });
        if (c.clamp) td.append(el('div', { class: 'cl' }, v ?? ''));
        else if (v && v.nodeType) td.append(v);
        else if (Array.isArray(v)) {
          const key = `${rowKey(r)}|${c.key}`;
          const pcts = c.share != null && r.share ? r.share[c.share] : null;
          const draw = () => td.replaceChildren(listCell(v, pcts, expanded.has(key), () => {
            expanded.has(key) ? expanded.delete(key) : expanded.add(key); draw();
          }));
          draw();
          if (pcts) td.title = 'Ordered by share of counted cells';
        } else td.textContent = c.type === 'num' && !c.render ? fmt.n(v) : (v ?? '');
        tr.append(td);
      }
      frag.append(tr);
    }
    tbody.replaceChildren(frag);
    const nf = Object.values(state.filters).filter(v => v !== '' && v != null).length;
    const clear = el('a', { href: '#', text: 'clear column filters', onclick: e => { e.preventDefault(); state.filters = {}; buildHead(); render(); } });
    const dl = el('a', { href: '#', text: 'download view (TSV)', onclick: e => {
      e.preventDefault();
      download(`${name}.tsv`, toTSV(columns.map(c => c.label), filtered().map(r => columns.map(c => { const v = val(c, r); return Array.isArray(v) ? v.join('; ') : v; }))));
    } });
    meta.replaceChildren(
      el('span', { text: `${fmt.n(out.length)} rows${out.length !== state.rows.length ? ` (of ${fmt.n(state.rows.length)}${nf ? `; ${nf} column filter${nf > 1 ? 's' : ''}` : ''})` : ''}` +
        (out.length > maxRows ? ` · showing first ${maxRows} by ${columns.find(x => x.key === state.sort.key)?.label} ${state.sort.dir === 'asc' ? '↑' : '↓'}` : '') }),
      nf ? clear : '', dl);
    if (api.onFilter) api.onFilter(out);
  }
  const api = {
    setRows(r) { state.rows = r; buildHead(); render(); },
    setFilter(k, v) { state.filters[k] = v; buildHead(); render(); },
    setColumns(cols) { columns = cols; buildHead(); render(); },
    filtered, onFilter: null,
  };
  buildHead(); render();
  return api;
}

/* ---- Column filter: a text box that is also a dropdown -------------------------------------
   options [[shown, count, raw]], most frequent first. Typing filters the list and the table ("contains",
   or exact when it equals a value); picking from the list (click, or arrows + Enter) filters exactly.
   The list is position:fixed under the box, so the table's scroll container cannot clip it. */
function filterCombo({ options, value = '', label = '', placeholder = 'any', onChange }) {
  const input = el('input', { type: 'text', value, placeholder, autocomplete: 'off', role: 'combobox',
    'aria-label': `Filter ${label}`, 'aria-expanded': 'false', 'aria-autocomplete': 'list' });
  const btn = el('button', { type: 'button', class: 'fc-btn', 'aria-label': `Show ${label} values`, tabindex: '-1', text: '▾' });
  const wrap = el('div', { class: 'fc' }, input, btn);
  let list = null, hi = -1, shown = [], overList = false;
  const close = () => { list?.remove(); list = null; hi = -1; overList = false; input.setAttribute('aria-expanded', 'false');
    window.removeEventListener('scroll', onScroll, true); };
  // the page scrolling would leave the fixed list behind its box; scrolling the list itself must not close it
  const onScroll = e => { if (list && !list.contains(e.target)) close(); };
  function draw(q) {
    const t = (q || '').toLowerCase();
    shown = options.filter(o => !t || o[0].toLowerCase().includes(t));
    const frag = document.createDocumentFragment();
    if (input.value) frag.append(el('div', { class: 'opt muted', 'data-i': '-2', text: 'clear filter' }));
    shown.slice(0, 300).forEach((o, i) => frag.append(el('div', { class: `opt${i === hi ? ' hi' : ''}`, 'data-i': String(i) },
      el('span', { text: o[0] }), el('span', { class: 'r', text: fmt.n(o[1]) }))));
    if (shown.length > 300) frag.append(el('div', { class: 'opt muted', text: `…${shown.length - 300} more, keep typing` }));
    if (!shown.length) frag.append(el('div', { class: 'opt muted', text: 'no value matches; filtering by "contains"' }));
    list.replaceChildren(frag);
  }
  function open() {
    if (!list) {
      list = el('div', { class: 'fc-list', role: 'listbox' });
      list.addEventListener('mouseenter', () => { overList = true; });
      list.addEventListener('mouseleave', () => { overList = false; });
      list.addEventListener('mousedown', e => {
        e.preventDefault();
        const i = +(e.target.closest('[data-i]')?.dataset.i ?? -1);
        if (i === -2) { input.value = ''; close(); onChange('', ''); }
        else if (i >= 0) pick(i);
      });
      document.body.append(list);
      window.addEventListener('scroll', onScroll, true);
      input.setAttribute('aria-expanded', 'true');
    }
    const r = input.getBoundingClientRect();
    Object.assign(list.style, { left: `${r.left}px`, top: `${r.bottom + 2}px`, minWidth: `${Math.max(r.width, 180)}px` });
    draw(input.value);
  }
  function pick(i) { const o = shown[i]; if (!o) return; input.value = o[0]; close(); onChange(o[0], o[2]); }
  input.addEventListener('focus', () => { if (!list) open(); });
  input.addEventListener('click', () => { if (!list) open(); });   // already focused after a pick
  input.addEventListener('input', () => { hi = -1; open(); onChange(input.value); });
  // dragging the list's scrollbar can blur the box (browser-dependent): stay open while the pointer is on the list
  input.addEventListener('blur', () => setTimeout(() => { if (overList && list) input.focus(); else close(); }, 120));
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!list) open(); hi = Math.min(hi + 1, Math.min(shown.length, 300) - 1); draw(input.value); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(hi - 1, 0); draw(input.value); }
    else if (e.key === 'Enter' && hi >= 0) { e.preventDefault(); pick(hi); }
    else if (e.key === 'Escape') close();
  });
  btn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); list ? close() : (input.focus(), open()); });
  btn.addEventListener('click', e => e.stopPropagation());
  return { el: wrap, input };
}

/* ---- Searchable combobox: options {key, label, right, search} ---------------------------- */
function makeCombo(host, { options, placeholder, onPick, value = '' }) {
  const input = el('input', { type: 'search', placeholder, value });
  const list = el('div', { class: 'list', hidden: true });
  const box = el('div', { class: 'combo' }, input, list);
  host.replaceChildren(box);
  function show(q) {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = options.filter(o => terms.every(t => o.search.includes(t)));
    const frag = document.createDocumentFragment();
    hits.slice(0, 300).forEach(o => {
      const d = el('div', { class: 'opt' }, el('span', { text: o.label }), el('span', { class: 'r', text: o.right || '' }));
      d.addEventListener('mousedown', e => { e.preventDefault(); input.value = o.label; list.hidden = true; onPick(o); });
      frag.append(d);
    });
    if (hits.length > 300) frag.append(el('div', { class: 'opt muted', text: `…${hits.length - 300} more, keep typing` }));
    if (!hits.length) frag.append(el('div', { class: 'opt muted', text: 'no match' }));
    list.replaceChildren(frag); list.hidden = false;
  }
  input.addEventListener('focus', () => { input.select(); show(''); });
  input.addEventListener('input', () => show(input.value));
  input.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 120));
  return { input };
}

/* ---- Plotly wrappers (layout reads CSS vars at render time) ------------------------------- */
const Plot = {
  layout(extra = {}) {
    const v = cssVar;
    const base = {
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      font: { family: 'system-ui, -apple-system, Segoe UI, sans-serif', size: 12, color: v('--text') },
      margin: { l: 10, r: 20, t: 10, b: 40 },
      xaxis: { gridcolor: v('--grid'), linecolor: v('--axis'), zerolinecolor: v('--axis'), tickfont: { color: v('--text-2') }, automargin: true },
      yaxis: { gridcolor: v('--grid'), linecolor: v('--axis'), zerolinecolor: v('--axis'), tickfont: { color: v('--text-2') }, automargin: true },
      hoverlabel: { bgcolor: v('--surface'), bordercolor: v('--border'), font: { color: v('--text') } },
      showlegend: false,
    };
    return deepMerge(base, extra);
  },
  config: { displaylogo: false, responsive: true, modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'] },
  seq(token = '--seq') { return cssVar(token).split(',').map(s => s.trim()).filter(Boolean)
    .map((c, i, a) => [i / (a.length - 1), c]); },
  /* horizontal bars, single series: items [[label, value, hoverExtra?]] */
  hbar(div, items, { title = '', unit = 'cells', max = 25, onClick } = {}) {
    const top = items.slice(0, max).reverse();
    const h = Math.max(90, 24 * top.length + 56);       // ~16px bars: thin marks, never fill the band
    div.style.height = `${h}px`;
    Plotly.react(div, [{
      type: 'bar', orientation: 'h', x: top.map(d => d[1]), y: top.map(d => d[0]),
      marker: { color: cssVar('--s1') }, width: 0.7,
      customdata: top.map(d => d[2] || ''),
      hovertemplate: `<b>%{x:,}</b> ${unit}<br>%{y}%{customdata}<extra></extra>`,
    }], Plot.layout({ margin: { l: 10, r: 30, t: title ? 26 : 6, b: 30 }, title: title ? { text: title, font: { size: 13 }, x: 0 } : undefined,
      xaxis: { tickformat: '~s' }, yaxis: { ticksuffix: '  ' }, bargap: 0.25 }), Plot.config);
    if (onClick) { div.removeAllListeners?.('plotly_click'); div.on('plotly_click', e => onClick(e.points[0].y)); }
  },
};
function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' ? deepMerge(a[k], v) : v;
  }
  return out;
}
