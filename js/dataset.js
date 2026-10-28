/* Dataset page: metadata, identifiers, study siblings, and the composition the source supports. */
const Dataset = (() => {
  const ACC = {
    gse: a => `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${a}`,
    sra: a => `https://www.ncbi.nlm.nih.gov/sra/?term=${a}`,
    bioproject: a => `https://www.ncbi.nlm.nih.gov/bioproject/${a}`,
    ega: a => `https://ega-archive.org/${a.startsWith('EGAD') ? 'datasets' : 'studies'}/${a}`,
    arrayexpress: a => `https://www.ebi.ac.uk/biostudies/arrayexpress/studies/${a}`,
    hca: a => `https://explore.data.humancellatlas.org/projects/${a}`,
    cellxgene: a => `https://cellxgene.cziscience.com/collections/${a}`,
    pmids: a => `https://pubmed.ncbi.nlm.nih.gov/${a}/`,
    dois: a => `https://doi.org/${a}`,
  };
  const SRC = { cellxgene: 'CELLxGENE', hca: 'HCA', geo: 'GEO', scbasecount: 'scBaseCount', scp: 'Single Cell Portal',
    scea: 'Single Cell Expression Atlas', disco: 'DISCO', ucsc: 'UCSC Cell Browser', lungmap: 'LungMAP', manual: 'manual' };

  const sum = (rows, keyFn, valFn) => {
    const m = new Map();
    for (const r of rows) { const k = keyFn(r); m.set(k, (m.get(k) || 0) + valFn(r)); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  function kv(pairs) {
    const dl = el('dl', { class: 'kv' });
    for (const [k, v] of pairs) {
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
      dl.append(el('dt', { text: k }), el('dd', {}, v));
    }
    return dl;
  }
  const chips = (arr, cls, k = 24) => {
    const a = arr || [], box = el('div', { class: 'chips' }, a.slice(0, k).map(x => chip(x, cls)));
    if (a.length > k) {
      const more = el('a', { href: '#', text: `+${a.length - k} more` });
      more.addEventListener('click', e => { e.preventDefault(); more.replaceWith(...a.slice(k).map(x => chip(x, cls))); });
      box.append(more);
    }
    return box;
  };
  const link = (href, text) => el('a', { href, target: '_blank', rel: 'noopener noreferrer', text });

  function header(d, rec) {
    const tiles = el('div', { class: 'tiles' });
    const tile = (label, value, sub) => tiles.append(el('div', { class: 'tile' }, el('div', { class: 'label', text: label }),
      el('div', { class: 'value', text: value }), sub ? el('div', { class: 'sub', text: sub }) : ''));
    tile('Cells', fmt.c(d.n_cells) || '–', d.n_cells_primary != null && d.n_cells_primary !== d.n_cells ? `${fmt.c(d.n_cells_primary)} primary` : '');
    tile('Donors', fmt.c(d.n_donors) || '–');
    tile('Samples', fmt.c(d.n_samples) || '–');
    if (d.comp) tile('Cell types', fmt.n(d.comp.cell_types.length), d.comp.label);
    if (d.comp) tile('States', fmt.n(d.comp.diseases.length), d.comp.diseases.slice(0, 3).join(', '));
    if (rec?.download_gb != null) tile('Download', `${fmt.gb(rec.download_gb)} GB`, (d.formats || []).join(', '));
    return el('div', {},
      el('div', { class: 'muted' }, el('a', { href: '#/catalogue', text: '← Catalogue' }), ` · ${d.record_id}`),
      el('h1', { text: d.title || d.record_id }),
      d.study_title && d.study_title !== d.title ? el('div', { class: 'muted', text: d.study_title }) : '',
      el('div', { class: 'chips', style: 'margin-top:8px' }, chip(SRC[d.source] || d.source, 'src'),
        d.is_integration ? chip('integrated atlas') : ''),
      tiles);
  }

  function metaCard(d) {
    const ids = el('div', { class: 'chips' });
    for (const [k, f] of Object.entries(ACC)) for (const a of d[k] || []) ids.append(link(f(a), a), ' ');
    const desc = el('div', { class: 'desc clamped', text: d.description || '' });
    desc.addEventListener('click', () => desc.classList.toggle('clamped'));
    const sib = (d.siblings || []).map(([rid, src, title]) =>
      el('li', {}, el('a', { href: `#/dataset/${encodeURIComponent(rid)}`, text: title || rid }), el('span', { class: 'muted', text: ` · ${SRC[src] || src}` })));
    return el('div', { class: 'grid2' },
      el('div', { class: 'card' }, el('h3', { text: 'Metadata' }), kv([
        ['Study', d.study_id], ['Year', [d.year, d.journal].filter(Boolean).join(' · ')],
        ['DOI', d.doi ? link(`https://doi.org/${d.doi}`, d.doi) : null],
        ['Portal', d.url ? link(d.url, d.url.replace(/^https?:\/\//, '').slice(0, 70)) : null],
        ['Download', d.download_url ? link(d.download_url, d.download_url.split('/').pop() || d.download_url) : null],
        ['Access', [d.access, d.licence].filter(Boolean).join(' · ')],
        ['Raw counts', d.raw_counts], ['Author cell types', d.cell_type_annotations == null ? null : d.cell_type_annotations ? 'yes' : 'no'],
        ['Organisms', (d.organisms || []).join(', ')], ['Tissues', chips(d.tissue_labels)], ['Organs', chips(d.organs)],
        ['Diseases', chips(d.diseases)], ['Dev stage', chips(d.dev_groups)], ['Sample types', chips(d.sample_types)],
        ['Assays', chips(d.assays)], ['Modalities', chips(d.modalities)], ['Cell / nucleus', (d.suspension || []).join(', ')],
        ['Formats', (d.formats || []).join(', ')], ['Notes', d.notes],
      ])),
      el('div', { class: 'card' }, d.description ? el('h3', { text: 'Description' }) : '', desc,
        el('h3', { text: 'Identifiers' }), ids.childNodes.length ? ids : el('span', { class: 'muted', text: 'none' }),
        sib.length ? el('h3', { text: `Other records of this study (${sib.length})` }) : '', sib.length ? el('ul', {}, sib) : ''));
  }

  /* --- Census composition ------------------------------------------------------------------ */
  function composition(host, d) {
    const c = d.comp;
    const ct = c.cell_types.map(s => s.split('\t')[0]);
    const rows = c.rows.map(([a, b, t, dv, n]) => ({ ct: ct[a], st: c.diseases[b], ti: c.tissues[t], dv: c.dev[dv], n }));
    const st = { mode: 'pct', tissue: '', top: 40 };
    const controls = el('div', { class: 'toolbar' });
    const seg = el('div', { class: 'seg' });
    [['pct', '% of state'], ['count', 'cell counts']].forEach(([v, l]) => {
      const b = el('button', { type: 'button', text: l, class: st.mode === v ? 'on' : '' });
      b.addEventListener('click', () => { st.mode = v; seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
      seg.append(b);
    });
    const tsel = el('select', {}, el('option', { value: '', text: 'all tissues' }), c.tissues.map(t => el('option', { value: t, text: t })));
    tsel.addEventListener('change', () => { st.tissue = tsel.value; draw(); });
    const nsel = el('select', {}, [20, 40, 80, 1000].map(n => el('option', { value: n, text: n === 1000 ? 'all cell types' : `top ${n} cell types` })));
    nsel.value = '40'; nsel.addEventListener('change', () => { st.top = +nsel.value; draw(); });
    controls.append(el('label', {}, 'Colour by', seg), tsel, nsel);
    const heat = el('div', { class: 'plot' }), byState = el('div', { class: 'plot' }), byTissue = el('div', { class: 'plot' }),
      byDev = el('div', { class: 'plot' }), byDonor = el('div', { class: 'plot' }), tblHost = el('div');
    host.append(el('h2', { text: `Cell composition · ${c.label}` }),
      el('p', { class: 'lede', text: `${c.note}${c.primary_cells != null ? ` ${fmt.c(c.primary_cells)} primary cells.` : ''} Hover a cell for counts.` }),
      controls, el('div', { class: 'card' }, heat),
      el('div', { class: 'grid2', style: 'margin-top:14px' },
        el('div', { class: 'card' }, el('h3', { text: 'Cells by state' }), byState),
        el('div', { class: 'card' }, el('h3', { text: 'Cells by tissue' }), byTissue),
        el('div', { class: 'card' }, el('h3', { text: 'Cells by development stage' }), byDev),
        el('div', { class: 'card' }, el('h3', { text: 'Donors by state' }), byDonor)),
      el('h3', { text: 'Table view: cell type × state × tissue' }), tblHost);

    function draw() {
      const rs = st.tissue ? rows.filter(r => r.ti === st.tissue) : rows;
      const ctTot = sum(rs, r => r.ct, r => r.n).slice(0, st.top);
      const states = sum(rs, r => r.st, r => r.n);
      const yi = new Map(ctTot.map(([k], i) => [k, i])), xi = new Map(states.map(([k], i) => [k, i]));
      const z = ctTot.map(() => states.map(() => 0));
      for (const r of rs) if (yi.has(r.ct)) z[yi.get(r.ct)][xi.get(r.st)] += r.n;
      const stTot = states.map(([, n]) => n);
      const zc = st.mode === 'pct' ? z.map(row => row.map((v, j) => (v && stTot[j] ? 100 * v / stTot[j] : null)))
        : z.map(row => row.map(v => (v ? Math.log10(v + 1) : null)));
      const text = z.map((row, i) => row.map((v, j) => `${fmt.n(v)} cells · ${stTot[j] ? (100 * v / stTot[j]).toFixed(1) : 0}% of state`));
      heat.style.height = `${Math.max(260, 19 * ctTot.length + 150)}px`;
      Plotly.react(heat, [{
        type: 'heatmap', z: zc, x: states.map(s => s[0]), y: ctTot.map(s => s[0]), text, xgap: 2, ygap: 2,
        colorscale: Plot.seq(), zmin: 0, hoverongaps: false,
        hovertemplate: '<b>%{text}</b><br>%{y}<br>%{x}<extra></extra>',
        colorbar: { title: { text: st.mode === 'pct' ? '% of state' : 'log10 cells', side: 'right' }, thickness: 12, outlinewidth: 0 },
      }], Plot.layout({ margin: { l: 10, r: 10, t: 10, b: 10 }, xaxis: { side: 'top', tickangle: -30, gridcolor: 'rgba(0,0,0,0)' },
        yaxis: { autorange: 'reversed', gridcolor: 'rgba(0,0,0,0)', ticksuffix: ' ' } }), Plot.config);
      Plot.hbar(byState, states);
      Plot.hbar(byTissue, sum(rs, r => r.ti, r => r.n));
      Plot.hbar(byDev, sum(rs, r => r.dv, r => r.n));
      Plot.hbar(byDonor, Object.entries(d.donors || {}).sort((a, b) => b[1] - a[1]), { unit: 'donors' });
    }
    draw();
    makeTable(tblHost, { name: `${d.record_id.replace(':', '_')}_composition`, rows: sum(rows, r => `${r.ct}\u0000${r.st}\u0000${r.ti}`, r => r.n)
      .map(([k, n]) => { const [a, b, t] = k.split('\u0000'); return { ct: a, st: b, ti: t, n }; }),
      sort: { key: 'n', dir: 'desc' }, maxRows: 300, columns: [
        { key: 'ct', label: 'Cell type', filter: 'contains' }, { key: 'st', label: 'State' }, { key: 'ti', label: 'Tissue' },
        { key: 'n', label: 'Cells', type: 'num' }] });
  }

  /* --- per-sample sources (scBaseCount / HCA / DISCO) ------------------------------------------ */
  function samples(host, d) {
    const s = d.samples, ci = s.cols.indexOf('cells'), di = s.cols.indexOf('disease');
    const ti = s.cols.findIndex(c => c === 'tissue' || c === 'organ');
    const rows = s.rows.map(r => Object.fromEntries(s.cols.map((c, i) => [c, r[i]])));
    const a = el('div', { class: 'plot' }), b = el('div', { class: 'plot' }), tbl = el('div');
    host.append(el('h2', { text: 'Samples' }),
      el('p', { class: 'lede', text: `${fmt.n(s.rows.length)} samples with their recorded tissue, state and cell count. ` +
        'This source has no per-cell type labels in the catalogue yet.' }),
      el('div', { class: 'grid2' }, el('div', { class: 'card' }, el('h3', { text: 'Cells by state' }), a),
        el('div', { class: 'card' }, el('h3', { text: 'Cells by tissue' }), b)), el('h3', { text: 'Sample table' }), tbl);
    Plot.hbar(a, sum(s.rows, r => r[di] || 'unknown', r => r[ci] || 0));
    if (ti >= 0) Plot.hbar(b, sum(s.rows, r => r[ti] || 'unknown', r => r[ci] || 0));
    makeTable(tbl, { name: `${d.record_id.replace(':', '_')}_samples`, rows, maxRows: 400, sort: { key: 'cells', dir: 'desc' },
      columns: s.cols.map(c => ({ key: c, label: c, type: c === 'cells' ? 'num' : 'text' })) });
  }

  /* --- author annotations from the downloaded h5ad -------------------------------------------- */
  function author(host, d) {
    const A = d.author, cols = Object.keys(A.columns || {});
    if (!cols.length) return;
    const sel = el('select', {}, cols.map(c => el('option', { value: c, text: `${c} (${A.columns[c].length} values)` })));
    sel.value = A.best || cols[0];
    const bars = el('div', { class: 'plot' }), heat = el('div', { class: 'plot' });
    host.append(el('h2', { text: 'Author annotations (downloaded h5ad)' }),
      el('p', { class: 'lede', text: `The submitters' own obs columns, beyond the CELLxGENE schema. ${A.best ? `“${A.best}” looks like the main cell-type label and is cross-tabulated with state below.` : ''}` }),
      el('div', { class: 'toolbar' }, el('label', {}, 'Column', sel)), el('div', { class: 'card' }, bars),
      A.best_by_disease ? el('div', { class: 'card', style: 'margin-top:14px' }, el('h3', { text: `${A.best} × state (% of state)` }), heat) : '');
    const unl = el('p', { class: 'muted' });
    const draw = () => { Plot.hbar(bars, A.columns[sel.value], { max: 40 });
      const u = (A.unlabelled || {})[sel.value] || 0; unl.textContent = u ? `${fmt.n(u)} cells have no label in this column (not shown).` : ''; };
    bars.before(unl);
    sel.addEventListener('change', draw); draw();
    if (A.best_by_disease) {
      const tot = new Map(), st = new Map();
      A.best_by_disease.forEach(([l, s_, n]) => { tot.set(l, (tot.get(l) || 0) + n); st.set(s_, (st.get(s_) || 0) + n); });
      const ys = [...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50).map(e => e[0]);
      const xs = [...st.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
      const z = ys.map(() => xs.map(() => null)), t = ys.map(() => xs.map(() => ''));
      A.best_by_disease.forEach(([l, s_, n]) => { const i = ys.indexOf(l), j = xs.indexOf(s_);
        if (i >= 0) { z[i][j] = 100 * n / st.get(s_); t[i][j] = `${fmt.n(n)} cells · ${(100 * n / st.get(s_)).toFixed(1)}% of state`; } });
      heat.style.height = `${Math.max(240, 19 * ys.length + 150)}px`;
      Plotly.react(heat, [{ type: 'heatmap', x: xs, y: ys, z, text: t, xgap: 2, ygap: 2, colorscale: Plot.seq(), hoverongaps: false,
        hovertemplate: '<b>%{text}</b><br>%{y}<br>%{x}<extra></extra>', colorbar: { title: { text: '% of state', side: 'right' }, thickness: 12, outlinewidth: 0 } }],
        Plot.layout({ margin: { l: 10, r: 10, t: 10, b: 10 }, xaxis: { side: 'top', tickangle: -30, gridcolor: 'rgba(0,0,0,0)' },
          yaxis: { autorange: 'reversed', gridcolor: 'rgba(0,0,0,0)', ticksuffix: ' ' } }), Plot.config);
    }
  }

  function geo(host, d) {
    const g = d.geo;
    host.append(el('h2', { text: 'Samples (GEO metadata)' }),
      d.overall_design ? el('div', { class: 'card' }, el('h3', { text: 'Overall design' }), el('div', { class: 'desc', text: d.overall_design })) : '',
      el('p', { class: 'lede', text: `GEO records no per-cell labels. ${fmt.n(g.n)} samples` + (g.n > g.rows.length ? ` (first ${g.rows.length} shown)` : '') +
        '. Characteristics are the raw submitter text, kept for later harmonisation.' }));
    const tbl = el('div'); host.append(tbl);
    makeTable(tbl, { name: `${d.source_id}_samples`, maxRows: 300, rows: g.rows.map(r => ({ gsm: r[0], title: r[1], source: r[2], chars: r[3], strategy: r[4] })),
      columns: [{ key: 'gsm', label: 'GSM', render: r => link(`https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${r.gsm}`, r.gsm) },
        { key: 'title', label: 'Title', filter: 'contains' }, { key: 'source', label: 'Source name' },
        { key: 'chars', label: 'Characteristics', filter: 'contains', clamp: true }, { key: 'strategy', label: 'Library' }] });
  }

  function sdrf(host, d) {
    host.append(el('h2', { text: 'Sample sheet (SDRF, distinct values)' }),
      el('div', { class: 'card' }, kv(Object.entries(d.sdrf).map(([k, v]) => [k.replace(/^Characteristics\[|^Factor Value\[|\]$/g, ''), chips(v)]))));
  }

  async function init(host, recordId) {
    host.replaceChildren(el('div', { class: 'loading', text: 'Loading…' }));
    const [recs, d] = await Promise.all([Data.records(), Data.detail(recordId)]);
    if (!d) { host.replaceChildren(el('p', { text: `No record ${recordId}.` })); return; }
    const rec = recs.byId.get(recordId);
    host.replaceChildren(header(d, rec), metaCard(d));
    if (d.comp) composition(host, d);
    else if (d.source === 'cellxgene') host.append(el('h2', { text: 'Cell composition' }),
      el('p', { class: 'note', text: 'Not in the pinned Census release (newer, or no raw counts) and not downloaded yet; counts come from the h5ad once it is.' }));
    const dsid = recordId.replace(/^cellxgene:/, '');
    for (const p of (await Data.json('data/meta.json')).panels || []) {
      if (d.source === 'cellxgene' && (p.dataset_ids || []).includes(dsid)) host.append(el('p', { class: 'note' }, `Gene panel: ${p.title}. `,
        el('a', { href: `#/genes?ds=${encodeURIComponent(dsid)}&state=`, text: 'Open it for this dataset →' })));
    }
    if (d.author) author(host, d);
    if (d.samples) samples(host, d);
    if (d.geo) geo(host, d);
    if (d.sdrf) sdrf(host, d);
    window.scrollTo(0, 0);
  }
  return { init };
})();
