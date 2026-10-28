/* Summary: deduplicated totals, what the catalogue holds by year / source / organ / assay, and how
   complete each source's metadata is. Studies, not records: a study on three portals counts once. */
const Summary = (() => {
  const SRC = { cellxgene: 'CELLxGENE', hca: 'HCA', geo: 'GEO', scp: 'Single Cell Portal', scea: 'SCEA', disco: 'DISCO',
    ucsc: 'UCSC Cell Browser', lungmap: 'LungMAP', scbasecount: 'scBaseCount', manual: 'manual', 'no count': 'no count' };
  const DIMS = [['organs', 'Organs', 'organs'], ['disease_groups', 'Disease group', 'disease_groups'],
    ['modalities', 'Modality', 'modalities'], ['sample_types', 'Sample type', 'sample_types'],
    ['dev_groups', 'Development stage', 'dev'], ['suspension', 'Cells or nuclei', null], ['assays', 'Assay', null]];

  function bars(div, xs, ys, unit) {
    div.style.height = '260px';
    Plotly.react(div, [{ type: 'bar', x: xs, y: ys, marker: { color: cssVar('--s1') }, width: 0.7,
      hovertemplate: `<b>%{y:,}</b> ${unit}<br>%{x}<extra></extra>` }],
    Plot.layout({ margin: { l: 10, r: 10, t: 6, b: 30 }, yaxis: { tickformat: '~s' }, xaxis: { dtick: 2 }, bargap: 0.25 }), Plot.config);
  }

  function completeness(div, c) {
    const rows = c.rows, fields = c.fields;
    const y = rows.map(r => `${SRC[r[0]] || r[0]} (${fmt.n(r[1])})`);
    const z = rows.map(r => r.slice(2));
    div.style.height = `${34 * rows.length + 120}px`;
    Plotly.react(div, [{ type: 'heatmap', x: fields, y, z, zmin: 0, zmax: 100, xgap: 2, ygap: 2, colorscale: Plot.seq(),
      texttemplate: '%{z}%', hovertemplate: '<b>%{z}%</b> of records have %{x}<br>%{y}<extra></extra>',
      colorbar: { title: { text: '% of records', side: 'right' }, thickness: 12, outlinewidth: 0 } }],
    Plot.layout({ margin: { l: 10, r: 10, t: 10, b: 10 }, xaxis: { side: 'top', tickangle: -30, gridcolor: 'rgba(0,0,0,0)' },
      yaxis: { autorange: 'reversed', gridcolor: 'rgba(0,0,0,0)', ticksuffix: ' ' } }), Plot.config);
  }

  async function init(host) {
    host.replaceChildren(el('div', { class: 'loading', text: 'Loading…' }));
    const s = await Data.json('data/summary.json');
    const k = s.kpi;
    const tiles = el('div', { class: 'tiles' });
    const tile = (l, v, sub) => tiles.append(el('div', { class: 'tile' }, el('div', { class: 'label', text: l }),
      el('div', { class: 'value', text: v }), sub ? el('div', { class: 'sub', text: sub }) : ''));
    tile('Cells', fmt.c(k.cells), `in ${fmt.n(k.studies_counted)} studies with a count`);
    tile('Studies', fmt.n(k.studies), 'after cross-source linking');
    tile('Records', fmt.n(k.records), 'source entries (datasets, series, projects)');
    tile('Without a cell count', fmt.n(k.studies - k.studies_counted), 'studies; mostly GEO series');
    tile('Cell type × state counts', fmt.n(k.records_composition), 'records with a composition');
    const cls = Object.fromEntries(s.by_class.map(r => [r[0], r]));
    const cult = cls['cultured (cell line, culture, organoid, xenograft)'] || [0, 0, 0];
    tile('From cultured samples', fmt.c(cult[2]), `cells in ${fmt.n(cult[1])} cell-line, culture or organoid studies`);

    const yS = el('div', { class: 'plot' }), yC = el('div', { class: 'plot' });
    const src = el('div', { class: 'plot' }), cnt = el('div', { class: 'plot' }), comp = el('div', { class: 'plot' });
    const seg = el('div', { class: 'seg' });
    const grid = el('div', { class: 'grid3' });
    host.replaceChildren(
      el('h1', { text: 'Summary' }),
      el('p', { class: 'lede', text: `Scope: ${s.scope}. A study's cells are the largest count any one source gives it, so a study ` +
        'deposited on several portals counts once. Counts are a floor: studies without a count add nothing. ' +
        `The current year is partial (data to ${s.data_to || 'the snapshot date'}).` }),
      tiles,
      el('div', { class: 'grid2' },
        el('div', {}, el('h2', { text: 'Studies by year' }), el('div', { class: 'card' }, yS)),
        el('div', {}, el('h2', { text: 'Cells by year' }), el('div', { class: 'card' }, yC))),
      el('div', { class: 'grid2' },
        el('div', {}, el('h2', {}, 'By source ', seg), el('div', { class: 'card' }, src)),
        el('div', {}, el('h2', { text: 'Where each study\'s cell count comes from' }), el('div', { class: 'card' }, cnt))),
      el('h2', { text: 'Studies by category' }),
      el('p', { class: 'muted', text: 'A study counts once in every value it lists. Click a bar to open those records in the catalogue.' }),
      grid,
      el('h2', { text: 'Metadata completeness by source' }),
      el('p', { class: 'muted', text: 'Share of each source\'s records that carry a field. Gaps here are what the catalogue cannot yet filter on.' }),
      el('div', { class: 'card' }, comp),
      el('h2', { text: 'Largest studies' }), el('div', { class: 'card' }, el('ol', {}, s.largest.map(([id, t, n, c]) =>
        el('li', {}, el('b', { text: fmt.c(n) }), ` ${t || id} `, el('span', { class: 'muted', text: `· ${c}` }))))));

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // let the grid size the plots
    const years = s.by_year.filter(r => r[0] >= 2009);
    bars(yS, years.map(r => r[0]), years.map(r => r[1]), 'studies');
    bars(yC, years.map(r => r[0]), years.map(r => r[2]), 'cells');
    const METRICS = [['studies', 2, 'studies'], ['records', 1, 'records'], ['cells held', 3, 'cells']];
    const draw = i => {
      const [, col, unit] = METRICS[i];
      seg.querySelectorAll('button').forEach((b, j) => b.classList.toggle('on', i === j));
      Plot.hbar(src, [...s.by_source].sort((a, b) => b[col] - a[col]).map(r => [SRC[r[0]] || r[0], r[col],
        i === 2 ? '<br>a study on two portals counts in both' : '']), { unit });
    };
    METRICS.forEach(([l], i) => seg.append(el('button', { type: 'button', text: l, onclick: () => draw(i) })));
    draw(0);
    Plot.hbar(cnt, s.count_source.map(r => [SRC[r[0]] || r[0], r[1], `<br>${fmt.c(r[2])} cells`]), { unit: 'studies' });
    // all cards first: a plot measures its container when drawn, and the grid's columns depend on the card count
    const cards = DIMS.map(([key, label, col]) => {
      const d = el('div', { class: 'plot' });
      grid.append(el('div', { class: 'card' }, el('h3', { text: label }), d));
      return [d, key, col];
    });
    for (const [d, key, col] of cards) {
      Plot.hbar(d, s.dims[key].map(r => [r[0], r[1]]), { unit: 'studies', max: 15,
        onClick: col ? v => { location.hash = `#/catalogue?f.${col}=${encodeURIComponent(v)}`; } : null });
    }
    completeness(comp, s.completeness);
  }
  return { init };
})();
