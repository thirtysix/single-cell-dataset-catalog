/* Hash router (#/view/arg?query), theme toggle, build stamp, About page. */
const About = {
  async init(host) {
    const m = await Data.json('data/meta.json');
    const snaps = Object.entries(m.snapshots).map(([k, v]) => `${k} ${v.join(', ')}`).join(' · ');
    host.replaceChildren(el('div', { style: 'max-width:80ch' },
      el('h1', { text: 'About this catalogue' }),
      el('p', { text: `A catalogue of ${fmt.n(m.n_records)} public human single-cell / single-nucleus RNA-seq records ` +
        `(${fmt.n(m.n_studies)} studies after cross-source linking) from CELLxGENE, the Human Cell Atlas, GEO, Arc scBaseCount, ` +
        'the Broad Single Cell Portal, the EBI Single Cell Expression Atlas, DISCO, the UCSC Cell Browser and LungMAP.' }),
      el('h2', { text: 'Where the numbers come from' }),
      el('ul', {},
        el('li', { text: `Cell type × state counts for ${fmt.n(m.n_counted)} records: CELLxGENE Census ${m.census_version} ` +
          '(Cell Ontology types, MONDO states); scBaseCount (automated per-cell predictions, curated per-sample state); ' +
          'DISCO (its own cell-type vocabulary).' }),
        el('li', { text: `Census ${m.census_version} is the last Census release (no build after 2025-11-17). ` +
          `${fmt.n(m.n_discover || 0)} newer CELLxGENE datasets are counted from their h5ad obs tables, read over HTTP ` +
          'without downloading the expression matrices.' }),
        el('li', { text: 'GEO cell counts come from what submitters deposited: barcode lists, matrix headers and h5/h5ad shapes. ' +
          'Against other sources\' counts for the same series they agree closely (median ratio 0.98) when every sample has a file; ' +
          'when only some do the count is a floor, shown as ≥N. A number stated only in the series text is shown as ~N and ' +
          'never counted. Unfiltered 10x barcode lists are not counted.' }),
        el('li', { text: 'Author annotations: for downloaded h5ads, every submitter obs column beyond the CELLxGENE schema.' }),
        el('li', { text: 'Per-sample cells by state and tissue: scBaseCount (curated per sample), HCA (per-sample totals where submitted), DISCO.' }),
        el('li', { text: 'GEO: no per-cell labels; per-sample submitter metadata is shown for later harmonisation.' }),
        (m.panels || []).length ? el('li', { text: `Genes view: gene panels exported by analysis projects (${m.panels.map(p => p.title).join('; ')}). ` +
          'Expression is summed per dataset x region x lineage x state x assay there, so every filter here is recomputed from those sums.' }) : '',
        el('li', { text: 'Respiratory status and region: UBERON ancestry of tissue terms where a source gives them; ' +
          'a keyword classifier for free text (GEO, portal descriptions). GEO "core" precision in a hand check was 18/20.' })),
      el('h2', { text: 'Caveats' }),
      el('ul', {},
        el('li', { text: 'Study grouping is approximate; integrated atlases re-use cells from other datasets (Census "primary" flags avoid double counting in the respiratory overview).' }),
        el('li', { text: 'Disease labels are as each source records them; healthy synonyms are merged into "normal". Disease groups are keyword-based.' }),
        el('li', { text: 'Spatial datasets are only partly covered: records are tagged "spatial" from their text, and no spatial-specific portal is harvested yet.' }),
        el('li', { text: 'Cell counts are a floor: studies without a count add nothing to the totals.' })),
      el('h2', { text: 'Build' }),
      el('p', { class: 'muted', text: `Built ${m.built.replace('T', ' ')}. Snapshots: ${snaps}.` }),
      m.public ? '' : el('p', { class: 'muted', text: 'Source: 0.datasets_visualizations/002.AI_projects/sc-dataset-catalog (make stage).' })));
  },
};

const App = (() => {
  // the public build ships without genes.js / analyses.js, so those views are optional
  const VIEWS = { catalogue: Catalogue, dataset: Dataset, summary: Summary, organ: Organ, respiratory: Respiratory,
    celltype: CellLens, disease: DiseaseLens, about: About,
    ...(typeof Genes !== 'undefined' ? { genes: Genes } : {}), ...(typeof Analyses !== 'undefined' ? { analyses: Analyses } : {}) };
  function parse() {
    const h = location.hash.replace(/^#\/?/, '') || 'catalogue';
    const [path, q = ''] = h.split('?');
    const [view, ...rest] = path.split('/');
    return { view: VIEWS[view] ? view : 'catalogue', arg: decodeURIComponent(rest.join('/')), params: new URLSearchParams(q) };
  }
  async function route() {
    const { view, arg, params } = parse();
    document.querySelectorAll('main > section').forEach(s => { s.hidden = s.dataset.view !== view; });
    document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view ||
      (view === 'dataset' && a.dataset.view === 'catalogue') || (view === 'respiratory' && a.dataset.view === 'organ')));
    const host = document.getElementById(`view-${view}`);
    try { await (view === 'dataset' ? VIEWS[view].init(host, arg) : VIEWS[view].init(host, params)); }
    catch (e) { console.error(e); host.replaceChildren(el('p', { class: 'note', text: `Could not load this view: ${e.message}` })); }
  }
  function theme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('sccat-theme', t); } catch (_) {}
    document.getElementById('theme-toggle').textContent = t === 'dark' ? 'Light mode' : 'Dark mode';
  }
  async function boot() {
    theme(document.documentElement.getAttribute('data-theme') || 'light');
    document.getElementById('theme-toggle').addEventListener('click', () => {
      theme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      route();                                    // re-render: trace colours are data, not layout
    });
    window.addEventListener('hashchange', route);
    try {
      const m = await Data.json('data/meta.json');
      const newest = Object.values(m.snapshots).flat().sort().pop();
      document.getElementById('stamp').textContent = `built ${m.built.slice(0, 10)} · data to ${newest}`;
    } catch (_) {}
    route();
  }
  document.addEventListener('DOMContentLoaded', boot);
  return { route };
})();
