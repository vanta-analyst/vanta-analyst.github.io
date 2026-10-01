// Vanta Stock Scores · rankings page: filter, sort and page through the static ledger (works without JS too).
(function () {
  const $ = id => document.getElementById(id);
  const ol = $('list'); if (!ol) return;
  const items = [...ol.querySelectorAll('li[data-name]')];
  const total = items.length, PAGE = 50;
  let limit = PAGE, band = 'all';
  const num = (li, k, d) => { const v = li.dataset[k]; return v === '' || v == null ? d : parseFloat(v); };
  const sorters = {
    score: (a, b) => num(b, 'score', 0) - num(a, 'score', 0),
    upside: (a, b) => num(b, 'upside', -9) - num(a, 'upside', -9),
    peg: (a, b) => num(a, 'peg', 99) - num(b, 'peg', 99),
    name: (a, b) => a.dataset.name.localeCompare(b.dataset.name)
  };
  const bands = {
    all: () => true,
    zone: li => li.dataset.zone === '1',
    high: li => num(li, 'score', 0) >= 70,
    mid: li => { const s = num(li, 'score', 0); return s >= 50 && s < 70; },
    low: li => num(li, 'score', 0) < 50,
    penny: li => li.dataset.penny === '1',
    nopenny: li => li.dataset.penny !== '1'
  };
  const empty = document.createElement('li'); empty.className = 'empty';
  empty.textContent = 'No company matches. Clear the search or pick another filter.';
  const more = $('more');

  // initial state from the URL (?ind=…&country=…&band=…&q=…&sort=…)
  const P = new URLSearchParams(location.search);
  if (P.get('q')) $('q').value = P.get('q');
  if (P.get('ind')) $('ind').value = P.get('ind');
  if (P.get('country')) $('country').value = P.get('country');
  if (P.get('sort') && sorters[P.get('sort')]) $('sort').value = P.get('sort');
  if (P.get('band') && bands[P.get('band')]) band = P.get('band');
  const segBtns = [...document.querySelectorAll('#band button')];
  const paint = () => segBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.band === band)));

  function render(keepLimit) {
    if (!keepLimit) limit = PAGE;
    const q = $('q').value.trim().toLowerCase(), ind = $('ind').value, ctry = $('country').value, sort = $('sort').value;
    const sorted = [...items].sort(sorters[sort] || sorters.score);
    let shown = 0, matched = 0;
    sorted.forEach(li => {
      const ok = (!q || li.dataset.name.toLowerCase().includes(q) || li.dataset.ind.toLowerCase().includes(q) || li.dataset.country.toLowerCase().includes(q))
        && (!ind || li.dataset.ind === ind) && (!ctry || li.dataset.country === ctry) && bands[band](li);
      if (ok) matched++;
      const vis = ok && shown < limit; if (vis) shown++;
      li.hidden = !vis; ol.append(li);
    });
    if (!matched) ol.append(empty); else empty.remove();
    $('count').textContent = matched === total ? `${total} companies` : `${matched} of ${total} companies`;
    const reset = $('reset'); if (reset) reset.hidden = !(q || ind || ctry || band !== 'all' || sort !== 'score');
    if (more) { more.hidden = matched <= shown; more.textContent = `Show ${Math.min(PAGE, matched - shown)} more`; }
    const u = new URLSearchParams();
    if (q) u.set('q', q); if (ind) u.set('ind', ind); if (ctry) u.set('country', ctry);
    if (band !== 'all') u.set('band', band); if (sort !== 'score') u.set('sort', sort);
    history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : ''));
    paint();
  }
  ['q'].forEach(id => $(id).addEventListener('input', () => render()));
  ['ind', 'country', 'sort'].forEach(id => $(id).addEventListener('change', () => render()));
  segBtns.forEach(b => b.addEventListener('click', () => { band = b.dataset.band; render(); }));
  if (more) more.addEventListener('click', () => { limit += PAGE; render(true); });
  if ($('reset')) $('reset').addEventListener('click', () => {
    $('q').value = ''; $('ind').value = ''; $('country').value = ''; $('sort').value = 'score'; band = 'all'; render();
  });
  render();
  // on narrow screens the band row scrolls sideways: bring the chosen band into view
  const on = segBtns.find(b => b.dataset.band === band), seg = $('band');
  if (on && seg && seg.scrollWidth > seg.clientWidth) seg.scrollLeft = on.offsetLeft - seg.offsetLeft - 16;
})();
