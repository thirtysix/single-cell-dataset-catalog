/* Catalogue: every record, with quick scopes above and per-column filters in the header. */
const Catalogue = (() => {
  let table = null, recs = null;
  const scope = { scOnly: true, respOnly: false, countsOnly: false, q: '' };
  const COUNT_LABEL = { celltype: 'cell type × state', samples: 'per-sample', geo: 'sample metadata', sdrf: 'sample sheet',
    geo_files: 'GEO files', geo_partial: 'GEO files (some samples)', '': '' };
  const SOURCE_LABEL = { cellxgene: 'CELLxGENE', hca: 'HCA', geo: 'GEO', scp: 'Single Cell Portal', scea: 'SCEA',
    disco: 'DISCO', ucsc: 'UCSC Cell Browser', lungmap: 'LungMAP', scbasecount: 'scBaseCount', manual: 'manual' };
  const HIDDEN_DEFAULT = ['study_title', 'dev', 'sample_types', 'download_gb', 'year'];
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
      { key: 'dev', label: 'Dev stage', type: 'list', share: 3 },
      { key: 'sample_types', label: 'Sample type', type: 'list' },
      { key: 'modalities', label: 'Modality', type: 'list', group: true },
      // GEO: partial file coverage is a floor (≥N); a number only stated in the series text is shown (~N) but
      // never sorted, filtered or totalled as a count: checked against other sources it was off by ~21x
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

  let meta = null;
  const pub = () => !!(meta && meta.public);
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
        r.organs.join(' '), r.assays.join(' '), r.doi].join(' ').toLowerCase()).includes(t))));
    table.setRows(rows);
  }

  async function init(host, params) {
    [recs, meta] = await Promise.all([Data.records(), Data.json('data/meta.json')]);
    for (const [k] of params) if (k.startsWith('f.')) hidden.delete(k.slice(2));   // a linked filter needs its column
    if (params.get('region')) hidden.delete('regions');
    if (params.get('resp') === '1') scope.respOnly = true;
    const check = (key, label) => {
      const cb = el('input', { type: 'checkbox' }); cb.checked = scope[key];
      cb.addEventListener('change', () => { scope[key] = cb.checked; apply(); });
      return el('label', {}, cb, label);
    };
    const search = el('input', { type: 'search', placeholder: 'Search title, tissue, disease, assay, DOI…' });
    let t = null;
    search.addEventListener('input', () => { scope.q = search.value; clearTimeout(t); t = setTimeout(apply, 150); });
    const tableHost = el('div');
    host.replaceChildren(
      el('h1', { text: 'Catalogue' }),
      el('p', { class: 'lede', text: 'One row per source record (a CELLxGENE dataset, HCA project, GEO series, portal study…). ' +
        'Records of the same study share a study id and are cross-linked on their pages. Filter in the column headers; ' +
        'open a dataset for its metadata and cell composition.' }),
      el('div', { class: 'toolbar' }, search, check('scOnly', 'single-cell RNA only'),
        pub() ? '' : check('respOnly', 'respiratory only'), check('countsOnly', 'has cell counts'), picker()),
      tableHost);
    table = makeTable(tableHost, { columns: visible(), rows: [], sort: { key: 'n_cells', dir: 'desc' }, name: 'catalogue',
      initialFilters: { ...(params.get('region') ? { regions: params.get('region') } : {}),
        ...Object.fromEntries([...params].filter(([k]) => k.startsWith('f.')).map(([k, v]) => [k.slice(2), v])) } });
    apply();
  }
  return { init };
})();
