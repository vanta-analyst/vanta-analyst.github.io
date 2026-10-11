// Vanta Stock Scores · rankings page: filter, sort and page through the static ledger (works without JS too).
(function () {
  const $ = id => document.getElementById(id);
  const ol = $('list'); if (!ol) return;
  const items = [...ol.querySelectorAll('li[data-name]')];
  items.forEach((li, k) => { li.dataset.r0 = k; });   // the official order breaks ties
  const total = items.length, PAGE = 50;
  let limit = PAGE, band = 'all', hz = 3;
  const num = (li, k, d) => { const v = li.dataset[k]; return v === '' || v == null ? d : parseFloat(v); };
  const sorters = {
    score: (a, b) => num(b, 'score', 0) - num(a, 'score', 0) || a.dataset.r0 - b.dataset.r0,
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
  if (P.get('h')) hz = Math.min(10, Math.max(1, parseInt(P.get('h'), 10) || 3));
  const segBtns = [...document.querySelectorAll('#band button')];
  const paint = () => segBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.band === band)));

  function render(keepLimit) {
    if (!keepLimit) limit = PAGE;
    const q = $('q').value.trim().toLowerCase(), ind = $('ind').value, ctry = $('country').value, sort = $('sort').value;
    const sorted = [...items].sort(sorters[sort] || sorters.score);
    let shown = 0, matched = 0; const picks = [];
    sorted.forEach(li => {
      const ok = (!q || li.dataset.name.toLowerCase().includes(q) || li.dataset.ind.toLowerCase().includes(q) || li.dataset.country.toLowerCase().includes(q))
        && (!ind || li.dataset.ind === ind) && (!ctry || li.dataset.country === ctry) && bands[band](li);
      if (ok) { matched++; if (picks.length < 25) picks.push(li); }
      const vis = ok && shown < limit; if (vis) shown++;
      li.hidden = !vis; ol.append(li);
    });
    if (!matched) ol.append(empty); else empty.remove();
    $('count').textContent = matched === total ? `${total} companies` : `${matched} of ${total} companies`;
    const reset = $('reset'); if (reset) reset.hidden = !(q || ind || ctry || band !== 'all' || sort !== 'score');
    // hand the first matches (in the current order) to the portfolio builder
    const tp = $('toport');
    if (tp) {
     tp.hidden = !picks.length;
      tp.textContent = `Build a portfolio from the first ${picks.length}`;
      tp.href = 'portfolio.html#p=' + picks.map(li => li.dataset.slug + '~50').join('.');
    }
    if (more) { more.hidden = matched <= shown; more.textContent = `Show ${Math.min(PAGE, matched - shown)} more`; }
    const u = new URLSearchParams();
    if (q) u.set('q', q); if (ind) u.set('ind', ind); if (ctry) u.set('country', ctry);
    if (band !== 'all') u.set('band', band); if (sort !== 'score') u.set('sort', sort); if (hz !== 3) u.set('h', hz);
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

  // holding-period view: re-weights each row's points (needs pdata.js + VantaH from site.js, so wait for all deferred scripts)
  document.addEventListener('DOMContentLoaded', () => {
    const H = window.VantaH, D = window.VANTA_P, X = window.VANTA_INDEX, row = $('hz-row'), r = $('hz-rank'), out = $('hz-rank-out');
    if (!H || !D || !X || !row || !r) return;
    const at = {}; X.forEach((x, i) => { at[x[1]] = i; });
    items.forEach(li => { li.dataset.base = li.dataset.score; });
    const head = document.querySelector('.lhead .h-sc');
    function applyH(h) {
      hz = h; r.value = h; r.setAttribute('aria-valuetext', H.label(h)); out.textContent = H.label(h);
      items.forEach(li => {
        const i = at[li.dataset.slug], v = i == null ? +li.dataset.base : H.score(D[i].slice(0, 7), h);
        li.dataset.score = v;
        const sb = li.querySelector('.scorecell .sb'); if (sb) { sb.textContent = v; sb.className = 'sb ' + H.band(v) + ' num'; }
      });
      [...items].sort((a, b) => b.dataset.score - a.dataset.score || a.dataset.r0 - b.dataset.r0)
        .forEach((li, k) => { const rk = li.querySelector('.rank'); if (rk) rk.textContent = k + 1; });
      if (head) head.textContent = h === 3 ? 'Score' : 'Score · ' + h + ' yr';
      render(true);
    }
    row.hidden = false;
    applyH(P.get('h') ? hz : H.get());
    r.addEventListener('input', () => { const h = H.clampH(+r.value); H.set(h); applyH(h); });
  });
  // on narrow screens the band row scrolls sideways: bring the chosen band into view
  const on = segBtns.find(b => b.dataset.band === band), seg = $('band');
  if (on && seg && seg.scrollWidth > seg.clientWidth) seg.scrollLeft = on.offsetLeft - seg.offsetLeft - 16;
})();
