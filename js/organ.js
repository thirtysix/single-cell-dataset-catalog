/* Organ overview: primary cells per organ, and for one organ its cells by state, development stage,
   cell type, assay and suspension, plus the catalogue records that list it. Respiratory system links
   to the region-level view. */
const Organ = (() => {
  const SRC = { cellxgene: 'CELLxGENE', hca: 'HCA', geo: 'GEO', scp: 'Single Cell Portal', scea: 'SCEA', disco: 'DISCO',
    ucsc: 'UCSC Cell Browser', lungmap: 'LungMAP', scbasecount: 'scBaseCount', manual: 'manual' };
  const pick = (rows, o) => rows.filter(r => r[0] === o).map(r => [r[1], r[2]]);

  async function init(host, params) {
    host.replaceChildren(el('div', { class: 'loading', text: 'Loading…' }));
    const d = await Data.json('data/organs.json');
    const organ = params.get('o') || 'respiratory system';
    const row = d.organs.find(r => r[0] === organ) || d.organs[0];
    const [o, cells, nds, nrec, nst] = row;
    const sel = el('select', { 'aria-label': 'Organ' }, d.organs.map(([n, c, , r]) =>
      el('option', { value: n, text: `${n} · ${c ? fmt.c(c) + ' cells' : r + ' records'}` })));
    sel.value = o;
    sel.addEventListener('change', () => { location.hash = `#/organ?o=${encodeURIComponent(sel.value)}`; });
    const tiles = el('div', { class: 'tiles' });
    const tile = (l, v, s) => tiles.append(el('div', { class: 'tile' }, el('div', { class: 'label', text: l }),
      el('div', { class: 'value', text: v }), s ? el('div', { class: 'sub', text: s }) : ''));
    tile('Primary cells', fmt.c(cells), `CELLxGENE Census ${d.census_version} + newer CELLxGENE datasets`);
    tile('CELLxGENE datasets', fmt.n(nds), 'with cells from this organ');
    tile('Catalogue records', fmt.n(nrec), 'single-cell RNA, every source');
    tile('Studies', fmt.n(nst), 'after cross-source linking');

    const all = el('div', { class: 'plot' });
    const P = ['state', 'dev', 'type', 'source', 'assay', 'susp'].reduce((a, k) => ({ ...a, [k]: el('div', { class: 'plot' }) }), {});
    const card = (title, plot, note) => el('div', {}, el('h2', { text: title }),
      el('div', { class: 'card' }, note ? el('p', { class: 'muted', text: note }) : '', plot));
    host.replaceChildren(
      el('h1', { text: 'Organs' }),
      el('p', { class: 'lede', text: 'Cells per organ from CELLxGENE (primary cells only, so integrated atlases do not double count), ' +
        'with the catalogue records that list each organ. Organs follow UBERON ancestry of each tissue term. ' +
        'Census covers CELLxGENE only: GEO, scBaseCount, DISCO and other portals add records here but not cells.' }),
      el('div', { class: 'toolbar' }, el('label', {}, 'Organ ', sel),
        o === 'respiratory system' ? el('a', { href: '#/respiratory', text: 'Respiratory regions in detail →' }) : '',
        el('a', { href: `#/catalogue?f.organs=${encodeURIComponent(o)}`, text: 'Open these records in the catalogue →' })),
      tiles,
      el('div', { class: 'grid2' }, card('Cells by state', P.state), card('Cells by development stage', P.dev)),
      el('div', { class: 'grid2' }, card('Most abundant cell types', P.type),
        card('Catalogue records by source', P.source)),
      el('div', { class: 'grid2' }, card('Cells by assay', P.assay), card('Cells or nuclei', P.susp)),
      card('Primary cells per organ', all, 'Click an organ to switch to it.'));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));   // let the grid size the plots
    const go = v => { location.hash = `#/organ?o=${encodeURIComponent(v)}`; };
    Plot.hbar(P.state, pick(d.by_state, o));
    Plot.hbar(P.dev, pick(d.by_dev, o));
    Plot.hbar(P.type, pick(d.by_type, o), { max: 20, onClick: ct => { location.hash = `#/celltype?label=${encodeURIComponent(ct)}`; } });
    Plot.hbar(P.source, pick(d.records_by_source, o).map(([s, n]) => [SRC[s] || s, n]).sort((a, b) => b[1] - a[1]),
      { unit: 'records' });
    Plot.hbar(P.assay, pick(d.by_assay, o));
    Plot.hbar(P.susp, pick(d.by_suspension, o));
    Plot.hbar(all, d.organs.filter(r => r[1] > 0).map(r => [r[0], r[1], `<br>${r[2]} datasets · ${r[3]} records`]),
      { max: 40, onClick: go });
  }
  return { init };
})();
