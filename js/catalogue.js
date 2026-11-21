/* Catalogue: every record, with quick scopes above and per-column filters in the header. */
const Catalogue = (() => {
  let table = null, recs = null;
  const scope = { scOnly: true, respOnly: false, countsOnly: false, q: '' };
  const COUNT_LABEL = { celltype: 'cell type × state', samples: 'per-sample', geo: 'sample metadata', sdrf: 'sample sheet',
    geo_files: 'GEO files', geo_partial: 'GEO files (some samples)', '': '' };
  const SOURCE_LABEL = { cellxgene: 'CELLxGENE', hca: 'HCA', geo: 'GEO', scp: 'Single Cell Portal', scea: 'SCEA',
    disco: 'DISCO', ucsc: 'UCSC Cell Browser', lungmap: 'LungMAP', scbasecount: 'scBaseCount', manual: 'manual' };
  const HIDDEN_DEFAULT = ['study_title', 'dev', 'sample_types', 'download_gb', 'year', 'ct_kind'];
  const CT_KIND = { curated: 'Curated Cell Ontology labels (CELLxGENE)', predicted: 'Predicted per cell (scBaseCount); cell-line samples left out',
    'DISCO labels': 'DISCO\'s own cell-type labels (not Cell Ontology)' };
  const BUILD_EV = { geo_field: 'From GEO\'s Genome_build / Assembly line', text: 'Named in the record\'s text (may also name a build it was lifted from)',
    pipeline: 'The source\'s own processing reference', schema: '' };
  const COLS_KEY = 'sccat-catalogue-hidden';
  let hidden = new Set(HIDDEN_DEFAULT);
  try { const h = JSON.parse(localStorage.getItem(COLS_KEY)); if (Array.isArray(h)) hidden = new Set(h); } catch (_) {}

  // Grouped left to right: what it is | biology (where in the body, state) | the data | where it comes from.
  // `group` starts a group (a divider in the table).
  function columns() {
    return [
      { key: 'title', label: 'Dataset', filter: 'contains', clamp: true, width: '28%',
        render: r => el('a', { href: `#/dataset/${encodeURIComponent(r.record_id)}`, text: r.title || r.record_id }) },
      { key: 'study_title', label: 'Study', filter: 'contains', clamp: true },
      { key: 'organs', label: 'Organs', type: 'list', share: 0, group: true },
      { key: 'tissue_terms', label: 'Tissue', type: 'list', share: 4 },
      { key: 'regions', label: 'Region', type: 'list', share: 1 },   // within the organ: distal colon, left ventricle, ...
      ...(pub() ? [] : [{ key: 'resp_class', label: 'Respiratory' }]),   // public site is organ-agnostic
      { key: 'disease_groups', label: 'State', type: 'list', share: 2 },
      // what was loaded, sorted or cultured, as the submitter states it per sample: not a measured composition.
      // the filter also offers the Cell Ontology terms they roll up to; cell lines never map
      { key: 'input_pops', label: 'Input population', type: 'list', pcts: r => r.in_share,
        fvals: r => r.in_roll.length ? [...new Set([...r.input_pops, ...r.in_roll])] : r.input_pops,
        tip: r => r.input_pops.length ? `As stated per sample (${r.in_src}): what was loaded, sorted or cultured, ` +
          'not the cell types measured. % = share of the record\'s samples with that value.' : '' },
      // curated (CELLxGENE), predicted (scBaseCount) or DISCO's own labels; shares are of all counted cells
      // the filter also offers the Cell Ontology terms they roll up to: "T cell" finds CD8 T cells, DISCO's "GZMB CD8 T cell"
      { key: 'cell_types', label: 'Cell types', type: 'list', pcts: r => r.ct_share,
        fvals: r => r.ct_roll.length ? [...new Set([...r.cell_types, ...r.ct_roll])] : r.cell_types, tip: r => r.ct_info
        ? `${CT_KIND[r.ct_info.kind] || r.ct_info.kind}. Share of all counted cells; ` +
          `${r.ct_info.unlabelled}% unlabelled. ${r.ct_info.n_types} labelled types in all ` +
          `(types under 0.2% are on the dataset page only).` : '' },
      { key: 'ct_kind', label: 'Cell type labels', get: r => r.ct_info ? r.ct_info.kind : '' },
      { key: 'dev', label: 'Dev stage', type: 'list', share: 3 },
      { key: 'sample_types', label: 'Sample type', type: 'list' },
      { key: 'modalities', label: 'Modality', type: 'list', group: true },
      // GEO: partial file coverage is a floor (≥N); a number only stated in the series text is shown (~N) but
      // never sorted, filtered or totalled as a count: checked against other sources it was off by ~21x
      // reference genome build: stated by the source (GEO's Genome_build / Assembly line, a pipeline) or named in text
      { key: 'genome', label: 'Genome', type: 'list', tip: r => r.genome.length ? BUILD_EV[r.build_ev] || '' : '' },
      { key: 'n_cells', label: 'Cells', type: 'num', render: r =>
        r.n_cells != null ? (r.counts === 'geo_partial'
          ? el('span', { class: 'soft', title: 'Counted from some samples\' files only: a floor', text: `≥${fmt.n(r.n_cells)}` })
          : fmt.n(r.n_cells))
        : r.n_reported ? el('span', { class: 'soft', title: 'Stated in the series text, not counted from files', text: `~${fmt.n(r.n_reported)}` }) : '' },
      { key: 'n_donors', label: 'Donors', type: 'num' },
      { key: 'counts', label: 'Counts', get: r => COUNT_LABEL[r.counts] },
      { key: 'source', label: 'Source', get: r => SOURCE_LABEL[r.source] || r.source, group: true },
      { key: 'year', label: 'Year', type: 'num', filter: false },
      { key: 'download_gb', label: 'GB', type: 'num', filter: false, render: r => fmt.gb(r.download_gb) },
      ...(pub() ? [] : [{ key: 'tier', label: 'Tier', get: r => r.tier || '' }]),
    ];
  }

  let meta = null, sstat = null;
  const pub = () => !!(meta && meta.public);

  /* "In this view": totals for whatever the search and column filters leave. Cells and donors are study-level
     (the largest count any source gives a study, as on the Summary page), so a study is never counted twice
     through its GEO, scBaseCount and CELLxGENE records; integrated atlases are left out, as in the headline. */
  const statsHost = el('aside', { class: 'viewstats', 'aria-label': 'Statistics for the rows in view' });
  function drawStats(rows) {
    if (!sstat) return;
    const S = sstat.studies, studies = new Set();
    for (const r of rows) {
      const s = S[r.study_id];
      if (s && s[2]) continue;                            // integrated atlas
      studies.add(r.study_id);
    }
    let cells = 0, counted = 0, donors = 0, withDonors = 0;
    for (const id of studies) {
      const s = S[id];
      if (!s) continue;
      if (s[0]) { cells += s[0]; counted++; }
      if (s[1] != null) { donors += s[1]; withDonors++; }
    }
    const nS = studies.size;
    const kpi = (label, value, sub, tip) => el('div', { class: 'vs-kpi', title: tip },
      el('div', { class: 'label', text: label }), el('div', { class: 'value', text: value }), el('div', { class: 'sub', text: sub }));
    statsHost.replaceChildren(
      el('div', { class: 'vs-head', text: 'In this view' }),
      el('div', { class: 'vs-kpis' },
        kpi('Records', fmt.n(rows.length), 'source entries', 'Rows left by the search and column filters.'),
        kpi('Studies', fmt.n(nS), 'deduplicated', 'Distinct studies behind those rows; integrated atlases left out.'),
        kpi('Cells', fmt.c(cells), `${fmt.n(counted)} studies counted`,
          `${fmt.n(cells)} cells. Per study, the largest count any one source gives it, so a study on three portals counts once.`),
        kpi('Donors', withDonors ? fmt.n(donors) : '–', `${fmt.n(withDonors)} studies report`,
          'Sum over studies that report a donor count; most studies do not, so this is a floor.')));
  }

  const visible = () => columns().filter(c => c.key === 'title' || !hidden.has(c.key));
  function picker() {
    const box = el('details', { class: 'colpick' }, el('summary', { text: 'Columns' }));
    const list = el('div', { class: 'colpick-list' });
    for (const c of columns()) {
      if (c.key === 'title') continue;
      const cb = el('input', { type: 'checkbox' }); cb.checked = !hidden.has(c.key);
      cb.addEventListener('change', () => {
        cb.checked ? hidden.delete(c.key) : hidden.add(c.key);
        try { localStorage.setItem(COLS_KEY, JSON.stringify([...hidden])); } catch (_) {}
        table.setColumns(visible());
      });
      list.append(el('label', {}, cb, c.label));
    }
    box.append(list);
    return box;
  }

  function apply() {
    const q = scope.q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = recs.filter(r => (!scope.scOnly || r.is_sc_rna) &&
      (!scope.respOnly || r.resp_class === 'core' || r.resp_class === 'adjacent') &&
      (!scope.countsOnly || ['celltype', 'samples', 'geo_files', 'geo_partial'].includes(r.counts)) &&
      (!q.length || q.every(t => (r._s ||= [r.title, r.study_title, r.record_id, r.tissues.join(' '), r.tissue_terms.join(' '), r.diseases.join(' '),
        r.organs.join(' '), r.cell_types.join(' '), r.ct_roll.join(' '), r.input_pops.join(' '), r.genome.join(' '), r.assays.join(' '), r.doi].join(' ').toLowerCase()).includes(t))));
    table.setRows(rows);
  }

  async function init(host, params) {
    [recs, meta] = await Promise.all([Data.records(), Data.json('data/meta.json')]);
    sstat = await Data.json('data/study_stats.json').catch(() => null);
    for (const [k] of params) if (k.startsWith('f.')) hidden.delete(k.slice(2));   // a linked filter needs its column
    if (params.get('region')) hidden.delete('regions');
    if (params.get('resp') === '1') scope.respOnly = true;
    const check = (key, label) => {
      const cb = el('input', { type: 'checkbox' }); cb.checked = scope[key];
      cb.addEventListener('change', () => { scope[key] = cb.checked; apply(); });
      return el('label', {}, cb, label);
    };
    const search = el('input', { type: 'search', placeholder: 'Search title, tissue, disease, cell type, assay, DOI…' });
    let t = null;
    search.addEventListener('input', () => { scope.q = search.value; clearTimeout(t); t = setTimeout(apply, 150); });
    const tableHost = el('div');
    host.replaceChildren(
      el('div', { class: 'cat-head' }, el('div', {},
        el('h1', { text: 'Catalogue' }),
        el('p', { class: 'lede', text: 'One row per source record (a CELLxGENE dataset, HCA project, GEO series, portal study…). ' +
          'Records of the same study share a study id and are cross-linked on their pages. Filter in the column headers; ' +
          'open a dataset for its metadata and cell composition. The panel sums whatever the filters leave.' })),
        sstat ? statsHost : ''),
      el('div', { class: 'toolbar' }, search, check('scOnly', 'single-cell RNA only'),
        pub() ? '' : check('respOnly', 'respiratory only'), check('countsOnly', 'has cell counts'), picker()),
      tableHost);
    table = makeTable(tableHost, { columns: visible(), rows: [], sort: { key: 'n_cells', dir: 'desc' }, name: 'catalogue',
      initialFilters: { ...(params.get('region') ? { regions: params.get('region') } : {}),
        ...Object.fromEntries([...params].filter(([k]) => k.startsWith('f.')).map(([k, v]) => [k.slice(2), v])) } });
    table.onFilter = drawStats;
    apply();
  }
  return { init };
})();
