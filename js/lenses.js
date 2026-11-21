/* Cell-type lens and disease lens: pivot the catalogue on one cell type or one state. */
const RESP_ORGANS = new Set(['lung', 'respiratory system', 'nose', 'pleura', 'pleural fluid']);

function organFilter(organs, onChange) {
  const sel = el('select', {}, el('option', { value: '', text: 'all organs' }),
    el('option', { value: '@resp', text: 'respiratory (lung, airways, nose, pleura)' }),
    [...organs].sort().map(o => el('option', { value: o, text: o })));
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}
function sourceFilter(sources, onChange) {
  const sel = el('select', {}, sources.map((s, i) => el('option', { value: String(i), text: s })),
    el('option', { value: 'all', text: 'all sources (may double count re-processed data)' }));
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}
const srcOk = (f, s) => f === 'all' || String(s) === f;
const organOk = (f, o) => !f || (f === '@resp' ? RESP_ORGANS.has(o) : o === f);
const tally = (rows, k, v) => {
  const m = new Map();
  for (const r of rows) m.set(k(r), (m.get(k(r)) || 0) + v(r));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

const CellLens = (() => {
  async function init(host, params) {
    host.replaceChildren(el('div', { class: 'loading', text: 'Loading cell-type counts…' }));
    const meta = await Data.json('data/meta.json');
    if (!meta.has_lens) { host.replaceChildren(el('p', { class: 'note', text: 'Census counts are not staged yet.' })); return; }
    const [L, recs] = await Promise.all([Data.json('data/lens_celltype.json'), Data.records()]);
    const byCt = new Map();
    L.rows.forEach(r => { if (!byCt.has(r[0])) byCt.set(r[0], []); byCt.get(r[0]).push(r); });
    const groups = new Map(L.groups.map(([id, name, members]) => [id, { name, members }]));
    const opts = [];
    L.cell_types.forEach(([id, label], i) => {
      const rs = byCt.get(i) || [];
      const n = rs.reduce((s, r) => s + r[4], 0), nd = new Set(rs.map(r => r[1])).size;
      const sub = (groups.get(id)?.members.length || 1) - 1;
      opts.push({ key: id, label, right: `${fmt.c(n)} cells · ${nd} datasets${sub > 0 ? ` · +${sub} subtypes` : ''}`,
        search: `${label} ${id}`.toLowerCase(), n });
    });
    L.groups.forEach(([id, name, members]) => {
      if (L.cell_types.some(c => c[0] === id)) return;
      const n = members.reduce((s, i) => s + (byCt.get(i) || []).reduce((a, r) => a + r[4], 0), 0);
      opts.push({ key: id, label: `${name} (group)`, right: `${fmt.c(n)} cells · ${members.length} types`, search: `${name} ${id} group`.toLowerCase(), n });
    });
    opts.sort((a, b) => b.n - a.n);
    const st = { id: params.get('id') || '', subtypes: true, organ: params.get('organ') || '@resp', src: params.get('src') || '0' };
    if (!st.id && params.get('label')) st.id = (L.cell_types.find(c => c[1] === params.get('label')) || [''])[0];
    if (!st.id) st.id = (L.cell_types.find(c => /ionocyte/.test(c[1])) || L.cell_types[0])[0];
    const pick = el('div'), out = el('div');
    const sub = el('input', { type: 'checkbox' }); sub.checked = true;
    sub.addEventListener('change', () => { st.subtypes = sub.checked; draw(); });
    const org = organFilter(L.organs, v => { st.organ = v; draw(); }); org.value = st.organ;
    const srcSel = sourceFilter(L.sources, v => { st.src = v; draw(); }); srcSel.value = st.src;
    host.replaceChildren(el('h1', { text: 'Cell-type lens' }),
      el('p', { class: 'lede', text: 'Pick a cell type (Cell Ontology) to see every dataset that contains it, with cells split by disease state and organ. ' +
        'CELLxGENE labels are curated; scBaseCount labels are automated predictions on re-processed SRA data. ' +
        '“Include subtypes” rolls up more specific terms (e.g. all type II pneumocyte subtypes).' }),
      el('div', { class: 'toolbar' }, pick, el('label', {}, sub, 'include subtypes'), org, srcSel), out);
    const label = id => (L.cell_types.find(c => c[0] === id) || [])[1] || groups.get(id)?.name || id;
    makeCombo(pick, { options: opts, placeholder: 'Search cell types…', value: label(st.id),
      onPick: o => { st.id = o.key; history.replaceState(null, '', `#/celltype?id=${encodeURIComponent(o.key)}`); draw(); } });

    function draw() {
      const idx = L.cell_types.findIndex(c => c[0] === st.id);
      const members = st.subtypes && groups.has(st.id) ? groups.get(st.id).members : idx >= 0 ? [idx] : [];
      const rows = members.flatMap(i => byCt.get(i) || []).filter(r => organOk(st.organ, L.organs[r[3]]) && srcOk(st.src, r[5]));
      const total = rows.reduce((s, r) => s + r[4], 0);
      const perDs = new Map();
      for (const r of rows) {
        const e = perDs.get(r[1]) || { n: 0, normal: 0, states: new Map(), organs: new Set() };
        e.n += r[4]; if (L.diseases[r[2]] === 'normal') e.normal += r[4];
        e.states.set(L.diseases[r[2]], (e.states.get(L.diseases[r[2]]) || 0) + r[4]); e.organs.add(L.organs[r[3]]);
        perDs.set(r[1], e);
      }
      const tiles = el('div', { class: 'tiles' });
      const tile = (l, v, s) => tiles.append(el('div', { class: 'tile' }, el('div', { class: 'label', text: l }), el('div', { class: 'value', text: v }), s ? el('div', { class: 'sub', text: s }) : ''));
      tile('Cells', fmt.c(total), label(st.id)); tile('Datasets', fmt.n(perDs.size));
      tile('States', fmt.n(new Set(rows.map(r => r[2])).size)); tile('Healthy cells', fmt.c(rows.filter(r => L.diseases[r[2]] === 'normal').reduce((s, r) => s + r[4], 0)));
      if (members.length > 1) tile('Cell types rolled up', fmt.n(members.length));
      const a = el('div', { class: 'plot' }), b = el('div', { class: 'plot' }), c = el('div', { class: 'plot' }), tbl = el('div');
      out.replaceChildren(tiles, el('div', { class: 'grid3' },
        el('div', { class: 'card' }, el('h3', { text: 'Cells by state' }), a),
        el('div', { class: 'card' }, el('h3', { text: 'Cells by organ' }), b),
        members.length > 1 ? el('div', { class: 'card' }, el('h3', { text: 'Cells by subtype' }), c) : ''),
        el('h2', { text: 'Datasets containing this cell type' }), tbl);
      Plot.hbar(a, tally(rows, r => L.diseases[r[2]], r => r[4]), { max: 20 });
      Plot.hbar(b, tally(rows, r => L.organs[r[3]], r => r[4]), { max: 20 });
      if (members.length > 1) Plot.hbar(c, tally(rows, r => L.cell_types[r[0]][1], r => r[4]), { max: 20 });
      makeTable(tbl, { name: `celltype_${st.id.replace(':', '_')}`, sort: { key: 'n', dir: 'desc' }, maxRows: 400,
        rows: [...perDs.entries()].map(([ri, e]) => {
          const rec = recs[ri] || {};
          return { rid: rec.record_id, title: rec.title, study: rec.study_title, source: rec.source, organs: [...e.organs], n: e.n, normal: e.normal,
            disease: e.n - e.normal, states: [...e.states.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${fmt.c(v)}`).join('; '),
            stateList: [...e.states.keys()] };
        }),
        columns: [
          { key: 'title', label: 'Dataset', filter: 'contains', clamp: true, render: r => el('a', { href: `#/dataset/${encodeURIComponent(r.rid)}`, text: r.title || r.rid }) },
          { key: 'study', label: 'Study', filter: 'contains', clamp: true },
          { key: 'organs', label: 'Organs', type: 'list' }, { key: 'stateList', label: 'State', type: 'list', render: r => r.states },
          { key: 'n', label: 'Cells', type: 'num' }, { key: 'normal', label: 'Healthy', type: 'num' }, { key: 'disease', label: 'Disease', type: 'num' }] });
    }
    draw();
  }
  return { init };
})();

const DiseaseLens = (() => {
  async function init(host, params) {
    host.replaceChildren(el('div', { class: 'loading', text: 'Loading state counts…' }));
    const meta = await Data.json('data/meta.json');
    if (!meta.has_lens) { host.replaceChildren(el('p', { class: 'note', text: 'Census counts are not staged yet.' })); return; }
    const [D, C, recs] = await Promise.all([Data.json('data/lens_disease.json'), Data.json('data/lens_celltype.json'), Data.records()]);
    const opts = [], byD = new Map();
    D.rows.forEach(r => { if (!byD.has(r[0])) byD.set(r[0], []); byD.get(r[0]).push(r); });
    D.diseases.forEach(([lab, grp], i) => {
      const rs = byD.get(i) || [];
      opts.push({ key: `d:${lab}`, label: lab, right: `${grp} · ${fmt.c(rs.reduce((s, r) => s + r[4], 0))} cells · ${new Set(rs.map(r => r[1])).size} datasets`,
        search: `${lab} ${grp}`.toLowerCase(), n: rs.reduce((s, r) => s + r[4], 0) });
    });
    const grps = [...new Set(D.diseases.map(d => d[1]))];
    grps.forEach(g => {
      const ids = D.diseases.map((d, i) => (d[1] === g ? i : -1)).filter(i => i >= 0);
      const n = ids.reduce((s, i) => s + (byD.get(i) || []).reduce((a, r) => a + r[4], 0), 0);
      opts.push({ key: `g:${g}`, label: `${g} (group of ${ids.length})`, right: `${fmt.c(n)} cells`, search: `${g} group`.toLowerCase(), n });
    });
    opts.sort((a, b) => b.n - a.n);
    const st = { key: params.get('key') || 'g:COPD', organ: params.get('organ') || '' };
    const pick = el('div'), out = el('div');
    const org = organFilter(D.organs, v => { st.organ = v; draw(); }); org.value = st.organ;
    host.replaceChildren(el('h1', { text: 'Disease lens' }),
      el('p', { class: 'lede', text: 'Pick a disease state (or a group such as COPD, IPF / ILD, lung cancer) to see cells by organ and source, ' +
        'the most common cell types (Census datasets), and every dataset that profiles it. Cell counts come from Census, scBaseCount and DISCO; ' +
        'labels are as each source records them, with healthy synonyms merged into “normal”.' }),
      el('div', { class: 'toolbar' }, pick, org), out);
    makeCombo(pick, { options: opts, placeholder: 'Search diseases or groups…', value: (opts.find(o => o.key === st.key) || {}).label || '',
      onPick: o => { st.key = o.key; history.replaceState(null, '', `#/disease?key=${encodeURIComponent(o.key)}`); draw(); } });

    function draw() {
      const ids = new Set(st.key.startsWith('g:') ? D.diseases.map((d, i) => (d[1] === st.key.slice(2) ? i : -1)).filter(i => i >= 0)
        : D.diseases.map((d, i) => (d[0] === st.key.slice(2) ? i : -1)).filter(i => i >= 0));
      const labels = new Set([...ids].map(i => D.diseases[i][0]));
      const rows = [...ids].flatMap(i => byD.get(i) || []).filter(r => organOk(st.organ, D.organs[r[2]]));
      const crow = C.rows.filter(r => labels.has(C.diseases[r[2]]) && organOk(st.organ, C.organs[r[3]]) && r[5] === 0);
      const total = rows.reduce((s, r) => s + r[4], 0);
      const perDs = new Map();
      for (const r of rows) {
        const e = perDs.get(r[1]) || { n: 0, src: r[3], organs: new Set(), labels: new Set() };
        e.n += r[4]; e.organs.add(D.organs[r[2]]); e.labels.add(D.diseases[r[0]][0]); perDs.set(r[1], e);
      }
      const tiles = el('div', { class: 'tiles' });
      const tile = (l, v, s) => tiles.append(el('div', { class: 'tile' }, el('div', { class: 'label', text: l }), el('div', { class: 'value', text: v }), s ? el('div', { class: 'sub', text: s }) : ''));
      tile('Cells', fmt.c(total)); tile('Datasets', fmt.n(perDs.size)); tile('Labels', fmt.n(labels.size), [...labels].slice(0, 3).join(', '));
      tile('Cell types (CELLxGENE)', fmt.n(new Set(crow.map(r => r[0])).size));
      const a = el('div', { class: 'plot' }), b = el('div', { class: 'plot' }), c = el('div', { class: 'plot' }), tbl = el('div');
      out.replaceChildren(tiles, el('div', { class: 'grid3' },
        el('div', { class: 'card' }, el('h3', { text: 'Cells by organ' }), a),
        el('div', { class: 'card' }, el('h3', { text: 'Cells by source' }), b),
        el('div', { class: 'card' }, el('h3', { text: 'Top cell types (CELLxGENE)' }), c)),
        el('h2', { text: 'Datasets profiling this state' }), tbl);
      Plot.hbar(a, tally(rows, r => D.organs[r[2]], r => r[4]), { max: 20 });
      Plot.hbar(b, tally(rows, r => r[3], r => r[4]));
      Plot.hbar(c, tally(crow, r => C.cell_types[r[0]][1], r => r[4]), { max: 25,
        onClick: ct => { location.hash = `#/celltype?label=${encodeURIComponent(ct)}`; } });
      makeTable(tbl, { name: `disease_${st.key.replace(/\W+/g, '_')}`, sort: { key: 'n', dir: 'desc' }, maxRows: 400,
        rows: [...perDs.entries()].map(([ri, e]) => {
          const rec = recs[ri] || {};
          return { rid: rec.record_id, title: rec.title, study: rec.study_title, source: rec.source, organs: [...e.organs], labels: [...e.labels], n: e.n };
        }),
        columns: [
          { key: 'title', label: 'Dataset', filter: 'contains', clamp: true, render: r => el('a', { href: `#/dataset/${encodeURIComponent(r.rid)}`, text: r.title || r.rid }) },
          { key: 'study', label: 'Study', filter: 'contains', clamp: true },
          { key: 'source', label: 'Source' }, { key: 'organs', label: 'Organs', type: 'list' }, { key: 'labels', label: 'State label', type: 'list' },
          { key: 'n', label: 'Cells', type: 'num' }] });
    }
    draw();
  }
  return { init };
})();
