/* Respiratory overview: Census respiratory cells by region x state / dev stage / cell type,
   and catalogue records by region x source. */
const Respiratory = (() => {
  const ORDER = ['upper airway', 'conducting airway', 'lung', 'distal lung', 'airway fluid', 'pleura', 'pleural fluid',
    'pharynx', 'lymph node', 'respiratory (unspecified)'];
  const ord = a => [...a].sort((x, y) => (ORDER.indexOf(x) + 99 * (ORDER.indexOf(x) < 0)) - (ORDER.indexOf(y) + 99 * (ORDER.indexOf(y) < 0)));

  function heat(div, triples, { colLabel = '', logColor = true, unit = 'cells', onClick } = {}) {
    const ys = ord([...new Set(triples.map(t => t[0]))]);
    const colTot = new Map();
    triples.forEach(([, c, n]) => colTot.set(c, (colTot.get(c) || 0) + n));
    const xs = [...colTot.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
    const z = ys.map(() => xs.map(() => 0));
    triples.forEach(([r, c, n]) => { z[ys.indexOf(r)][xs.indexOf(c)] += n; });
    div.style.height = `${Math.max(240, 34 * ys.length + 150)}px`;
    Plotly.react(div, [{
      type: 'heatmap', x: xs, y: ys, z: z.map(r => r.map(v => (v ? (logColor ? Math.log10(v + 1) : v) : null))),
      text: z.map(r => r.map(v => `${fmt.n(v)} ${unit}`)), xgap: 2, ygap: 2, colorscale: Plot.seq(), hoverongaps: false,
      hovertemplate: '<b>%{text}</b><br>%{y} · %{x}<extra></extra>',
      colorbar: { title: { text: logColor ? `log10 ${unit}` : unit, side: 'right' }, thickness: 12, outlinewidth: 0 },
    }], Plot.layout({ margin: { l: 10, r: 10, t: 10, b: 10 }, xaxis: { side: 'top', tickangle: -30, gridcolor: 'rgba(0,0,0,0)' },
      yaxis: { autorange: 'reversed', gridcolor: 'rgba(0,0,0,0)', ticksuffix: ' ' } }), Plot.config);
    if (onClick) div.on('plotly_click', e => onClick(e.points[0].y, e.points[0].x));
  }

  async function init(host) {
    host.replaceChildren(el('div', { class: 'loading', text: 'Loading…' }));
    const [r, recs] = await Promise.all([Data.json('data/respiratory.json'), Data.records()]);
    const resp = recs.filter(x => x.is_sc_rna && (x.resp_class === 'core' || x.resp_class === 'adjacent'));
    const studies = new Set(resp.map(x => x.study_id));
    const tiles = el('div', { class: 'tiles' });
    const tile = (l, v, s) => tiles.append(el('div', { class: 'tile' }, el('div', { class: 'label', text: l }),
      el('div', { class: 'value', text: v }), s ? el('div', { class: 'sub', text: s }) : ''));
    tile('Census respiratory cells', fmt.c(r.total_cells), 'unique primary cells');
    tile('Catalogue records', fmt.n(resp.length), 'respiratory single-cell RNA');
    tile('Studies', fmt.n(studies.size), 'after cross-source linking');
    tile('With cell-type counts', fmt.n(resp.filter(x => x.counts === 'celltype').length), 'CELLxGENE, scBaseCount, DISCO');
    const h1 = el('div', { class: 'plot' }), h2 = el('div', { class: 'plot' }), h3 = el('div', { class: 'plot' });
    const multiples = el('div', { class: 'grid3' });
    host.replaceChildren(
      el('p', {}, el('a', { href: '#/organ?o=respiratory%20system', text: '← All organs' })),
      el('h1', { text: 'Respiratory overview' }),
      el('p', { class: 'lede', text: 'Respiratory cells in CELLxGENE Census (primary cells only, so integrated atlases do not double count), ' +
        'by anatomical region. Regions come from UBERON ancestry of each cell’s tissue term. Click a region row to open its records in the catalogue.' }),
      tiles,
      el('h2', { text: 'Cells by region and state' }), el('div', { class: 'card' }, h1),
      el('div', { class: 'grid2' },
        el('div', {}, el('h2', { text: 'Cells by region and development stage' }), el('div', { class: 'card' }, h2)),
        el('div', {}, el('h2', { text: 'Catalogue records by region and source' }), el('div', { class: 'card' }, h3))),
      el('h2', { text: 'Most abundant cell types per region' }), multiples);
    const go = region => { location.hash = `#/catalogue?resp=1&region=${encodeURIComponent(region)}`; };
    heat(h1, r.region_disease, { onClick: go });
    heat(h2, r.region_dev, { onClick: go });
    heat(h3, r.records_by_region_source, { logColor: false, unit: 'records', onClick: go });
    // all cards first: each plot measures its container, and the grid's columns depend on the card count
    const cards = ord([...new Set(r.region_celltype.map(t => t[0]))]).map(region => {
      const d = el('div', { class: 'plot' });
      multiples.append(el('div', { class: 'card' }, el('h3', {}, region,
        el('span', { class: 'muted', text: ` · ${r.region_datasets[region] || 0} datasets` })), d));
      return [region, d];
    });
    for (const [region, d] of cards) {
      Plot.hbar(d, r.region_celltype.filter(t => t[0] === region).map(t => [t[1], t[2]]), { max: 10,
        onClick: ct => { location.hash = `#/celltype?label=${encodeURIComponent(ct)}`; } });
    }
  }
  return { init };
})();
